'use strict';
// Launch prices are proposals. No checkout or automatic paid subscriptions.
const PLANS=Object.freeze({
 beta:{id:'beta',name:{ar:'النسخة التجريبية',en:'Beta'},price:0,send:null,ai:null,gmail:null,cv:null},
 start:{id:'start',name:{ar:'بداية',en:'Start'},price:0,send:30,ai:10,gmail:1,cv:1},
 step:{id:'step',name:{ar:'خطوة',en:'Step'},price:149,send:150,ai:100,gmail:3,cv:3},
 launch:{id:'launch',name:{ar:'انطلاقة',en:'Launch'},price:249,send:400,ai:300,gmail:5,cv:5}
});
module.exports={PLANS,periodDays:30,billingEnabled:false};
