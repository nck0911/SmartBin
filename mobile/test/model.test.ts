import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decode, status, validateBin, initialBin } from '../src/model.ts';
const data = {schema:1,device_id:'a',fill_percent:87,gas_adc:2300,trash_valid:true,trash_stale:false,gas_valid:true,full:true,gas_high:true,lid_command:'closed',uptime_ms:1234};
test('accepts firmware schema and simultaneous alarms',()=>{assert.equal(decode(JSON.stringify(data),'a')?.gas_high,true);});
test('rejects malformed, wrong device, and out-of-range values',()=>{for(const raw of ['oops',JSON.stringify({...data,device_id:'b'}),JSON.stringify({...data,fill_percent:101}),JSON.stringify({...data,full:'true'}),JSON.stringify({...data,gas_adc:5000})])assert.equal(decode(raw,'a'),null);});
test('accepts invalid sensor null samples without clearing firmware alarms',()=>{assert.equal(decode(JSON.stringify({...data,fill_percent:null,trash_valid:false}),'a')?.full,true);});
test('retained-only data and timed-out data are never live',()=>{const d=decode(JSON.stringify(data),'a')!;assert.equal(status({data:d,receivedAt:20000},true,20000),'Dữ liệu cũ');assert.equal(status({data:d,liveAt:1000},true,17000),'Dữ liệu cũ');assert.equal(status({data:d,liveAt:1000},true,2000),'Đang cập nhật');assert.equal(status({data:d,liveAt:1000,availability:'offline'},true,2000),'Thùng đang ngoại tuyến');assert.equal(status({data:d},false,2000),'Mất kết nối dịch vụ');});
test('prevents duplicate subscriptions and wildcard roots',()=>{assert.ok(validateBin(initialBin,[initialBin]));assert.equal(validateBin(initialBin,[initialBin],initialBin.id),'');assert.ok(validateBin({...initialBin,topic:'a/#'},[]));});
