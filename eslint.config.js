'use strict';
const js=require('@eslint/js'),globals=require('globals');
// Bug-finding rules only, no style rules: the codebase is deliberately dense and is not reformatted here.
// Browser files are classic scripts that share globals across files, so no-undef is meaningless there.
module.exports=[
 {ignores:['node_modules/**','vendor/**','public/vendor/**','public/assets/**/*.min.js']},
 js.configs.recommended,
 {files:['**/*.js','**/*.cjs'],languageOptions:{ecmaVersion:2024,sourceType:'commonjs',globals:{...globals.node}},rules:{
  'no-empty':['error',{allowEmptyCatch:true}],
  'no-unused-vars':['warn',{args:'none',caughtErrors:'none'}],
  'no-control-regex':'off','no-useless-escape':'off','preserve-caught-error':'off','no-ex-assign':'warn'
 }},
 {files:['public/**/*.js'],languageOptions:{sourceType:'script',globals:{...globals.browser}},rules:{'no-undef':'off'}},
 {files:['tests/**'],rules:{'no-unused-vars':'off','no-dupe-keys':'off'}}
];
