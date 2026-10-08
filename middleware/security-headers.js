'use strict';
const fs=require('fs');
const path=require('path');
const {createHash}=require('crypto');
// Exact inline scripts are allowed by hash. Legacy onclick attributes are
// isolated in script-src-attr until those controls are migrated to listeners.
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const hashes=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(m=>! /\bsrc\s*=/i.test(m[1]))
 .map(m=>"'sha256-"+createHash('sha256').update(m[2]).digest('base64')+"'");
const csp=["default-src 'self'","base-uri 'none'","object-src 'none'","frame-ancestors 'none'",
 "form-action 'self' https://accounts.google.com","script-src 'self' "+hashes.join(' '),
 "script-src-attr 'unsafe-inline'","style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "font-src 'self' https://fonts.gstatic.com","img-src 'self' data: blob: https:",
 "connect-src 'self'","frame-src 'none'"].join('; ');
module.exports=(req,res,next)=>{
 const account=req.path==='/auth/account'||req.path==='/account.html';
 res.setHeader('Content-Security-Policy',account?csp.replace("script-src 'self' ","script-src 'self' https://challenges.cloudflare.com ").replace("connect-src 'self'","connect-src 'self' https://challenges.cloudflare.com").replace("frame-src 'none'","frame-src https://challenges.cloudflare.com"):csp);
 if(req.path==='/notifications-sw.js')res.setHeader('Cache-Control','no-cache');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 if(req.secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
 next();
};
