'use strict';
// Launch prices are proposals. No checkout or automatic paid subscriptions.
const PLANS=Object.freeze({
 beta:{id:'beta',name:{ar:'النسخة التجريبية',en:'Beta'},price:0,send:null,ai:null,gmail:null,cv:null},
 start:{id:'start',name:{ar:'بداية',en:'Start'},price:99,send:100,ai:50,gmail:1,cv:3},
 step:{id:'step',name:{ar:'خطوة',en:'Step'},price:199,send:250,ai:150,gmail:3,cv:5},
 launch:{id:'launch',name:{ar:'انطلاقة',en:'Launch'},price:349,send:600,ai:400,gmail:5,cv:10}
});
module.exports={PLANS,periodDays:30,billingEnabled:false};
