function dg(s){
  return document.getElementById(s);
}

window.onload=function (){
  dg("source").value="0 is empty;\n1 is {0};\n2 is {0,1};";
  dg("compile").onclick=function (){
    dg("out").value=compile(dg("source").value);
  };
  dg("compile").click();
};

function compile(s){
  s=tokenizeSource(s);
  s=treeifyToken(s);
  return stringifyTree(s);
}
var reserved=[
  "is",
  "empty",
  "exists",
  "subsetof"
];
function tokenizeSource(expression){
  var P={};
  if (typeof expression!="string") throw Error("Expected string");
  var r=[];
  var s="";
  for (var i=0;i<expression.length;i++){
    s+=expression[i];
    var peek=expression[i+1];
    if (s=="("){
      r.push({
        type:"LParen"
      });
      s="";
    }else if (s==")"){
      r.push({
        type:"RParen"
      });
      s="";
    }else if (s=="["){
      r.push({
        type:"LBrack"
      });
      s="";
    }else if (s=="]"){
      r.push({
        type:"RBrack"
      });
      s="";
    }else if (s=="{"){
      r.push({
        type:"LBrace"
      });
      s="";
    }else if (s=="}"){
      r.push({
        type:"RBrace"
      });
      s="";
    }else if (s=="["){
      r.push({
        type:"LBrack"
      });
      s="";
    }else if (s=="]"){
      r.push({
        type:"RBrack"
      });
      s="";
    }else if (reserved.includes(s)&&/^[^A-Za-z0-9]$/.test(peek)){
      r.push({
        type:"keyword",
        value:s
      });
      s="";
    }else if (/^[A-Za-z0-9]+$/.test(s)&&/^[^A-Za-z0-9]$/.test(peek)){
      r.push({
        type:"variable",
        value:s
      });
      s="";
    }else if (s==";"){
      r.push({
        type:"EOL"
      });
      s="";
    }else if (s==","){
      r.push({
        type:"comma"
      });
      s="";
    }else if (s==" "||s=="\n"){
      s="";
    }
  }
  return r;
}
function treeifyToken(tokens){
  var temp;
  for (i=0;i<tokens.length;i++){ //Divide statements
    if (tokens[i].type=="EOL"){
      return specialParser.multipleStatements(tokens);
    }
    if (tokens[i].type=="LBrace"){
      var nest=1;
      i++;
      while (nest){
        if (i==tokens.length) throw Error("SyntaxError: Nonterminated '{'");
        if (tokens[i].type=="LBrace") nest++;
        if (tokens[i].type=="RBrace") nest--;
        if (nest) i++;
      }
    }
  }
  if (tokens.length>=2&&tokens[1].type=="keyword"&&tokens[1].value=="is"){
    return specialParser.is(tokens);
  }
  return null;
}
var specialParser={};
specialParser.multipleStatements=function (tokens){
  var temp=[];
  var j=0;
  for (var i=0;i<tokens.length;i++){
    if (tokens[i].type=="EOL"){
      temp.push(tokens.slice(j,i));
      j=i+1;
    }
    if (tokens[i].type=="LBrace"){
      var nest=1;
      i++;
      while (nest){
        if (i==tokens.length) throw Error("SyntaxError: Nonterminated '{'");
        if (tokens[i].type=="LBrace") nest++;
        if (tokens[i].type=="RBrace") nest--;
        if (nest) i++;
      }
    }
  }
  temp.push(tokens.slice(j,i));
  for (i=0;i<temp.length;i++){
    var j=treeifyToken(temp[i]);
    if (j){
      temp[i]=j;
    }else{
      temp.splice(i,1);
      i--;
    }
  }
  return {op:"multipleStatements",args:temp};
}
specialParser.is=function (tokens){
  if (tokens[0].type!="variable") throw Error ("SyntaxError: Invalid left-hand side in assignment");
  if (tokens[2].type=="keyword"&&tokens[2].value=="empty"){
    return {op:"is",args:[tokens[0].value,"empty"]};
  }else if (tokens[2].type=="keyword"&&tokens[2].value=="subsetof"){
    return {op:"is",args:[tokens[0].value,specialParser.subsetof(tokens.slice(3))]};
  }else if (tokens[2].type=="LBrace"){
    return {op:"is",args:[tokens[0].value,specialParser.setBuild(tokens.slice(2))]};
  }
};
specialParser.subsetof=function (tokens){
  if (tokens[0].type!="variable") throw Error("SyntaxError: Invalid parent set");
  return {op:"subsetof",args:[tokens[0].value]};
};
specialParser.setBuild=function (tokens){
  var temp;
  if (tokens[0].type!="LBrace") throw Error("SyntaxError: I give up.");
  if (tokens[tokens.length-1].type!="RBrace") throw Error("SyntaxError: Nonterminated set notation");
  temp=[];
  for (var j=1;j<tokens.length;j+=2){
    if (tokens[j].type!="variable") throw Error("SyntaxError: Unexpected token '"+tokens[j].value+"'");
    if (tokens[j+1].type=="LBrace") throw Error("SyntaxError: Unexpected token '{'");
    if (j<tokens.length-2&&tokens[j+1].type=="RBrace") throw Error("SyntaxError: Unexpected token '}'");
    if (tokens[j+1].type=="Comma") throw Error("SyntaxError: Expected ','");
    temp.push(tokens[j].value);
  }
  return {op:"setBuild",args:temp};
}
function deepCloneArray(array){
  var r=[];
  for (var i=0;i<array.length;i++){
    var e=tree[i];
    if (typeof e=="boolean"||typeof e=="string") r.push(e);
    else if (e instanceof Array) r.push(deepCloneArray(e));
    else throw Error("Invalid expression tree");
  }
  return r;
}
function uniteSet(s,t){
  var r=new Set();
  for (var i of s.entries()) r.add(i[0]);
  for (var i of t.entries()) r.add(i[0]);
  return r;
}
function getBasicVariables(s){
  var r=new Set();
  if (s.op=="multipleStatements"){
    for (var i=0;i<s.args.length-1;i++){
      var p=getBasicVariables(s.args[i]);
      r=uniteSet(r,p);
    }
  }else if (s.op=="is"){
    r.add(s.args[0]);
    return r;
  }else return r;
}
function getFreeVariable(scope){
  var c="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var d=[0];
  while (true){
    var v="";
    for (var i=0;i<d.length;i++){
      v+=c[d[i]];
    }
    if (!scope.has(v)) return v;
    d[0]++;
    var i=0;
    while (d[i]==c.length){
      d[i]=0;
      d[i+1]=(d[i+1]||0)+1;
      i++;
    }
  }
}
function stringifyTree(s,scope){
  if (!scope){
    scope=getBasicVariables(s);
  }else{
    scope=uniteSet(scope,getBasicVariables(s));
  }
  if (s.op=="multipleStatements") return specialStringifier.multipleStatements(s,scope);
  if (s.op=="is") return specialStringifier.is(s,scope);
}
var char={};
char.and="\u2227";
char.exists="\u2203";
char.not="\u00ac";
char.in="\u2208";
var specialStringifier={};
specialStringifier.multipleStatements=function (s,scope){
  var r="";
  for (var i=0;i<s.args.length;i++){
    var p=stringifyTree(s.args[i],scope);
    if (r) r="("+r+char.and+p+")";
    else r=p;
  }
  return r;
}
specialStringifier.is=function (s,scope){
  var v=getFreeVariable(scope);
  var i,s,t;
  if (s.args[1]=="empty"){
    return "("+char.not+char.exists+v+"("+v+char.in+s.args[0]+"))";
  }else if (s.args[1].op=="subsetof"){
    return "("+char.not+char.exists+v+"(("+v+char.in+s.args[0]+char.and+"("+char.not+v+char.in+s.args[1].args[0]+"))))";
  }else if (s.args[1].op=="setBuild"){
    r="";
    for (i=0;i<s.args[1].args.length;i++){
      p=s.args[1].args[i]+char.in+s.args[0];
      if (r) r="("+r+char.and+p+")";
      else r=p;
    }
    t=v+char.in+s.args[0];
    for (i=0;i<s.args[1].args.length;i++){
      p="("+char.not+v+"="+s.args[1].args[i]+")";
      t="("+t+char.and+p+")";
    }
    t="("+char.not+char.exists+v+"("+t+")";
    return "("+r+char.and+t+")";
  }
}
