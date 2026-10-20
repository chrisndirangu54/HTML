import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedIp,monitor} from './security-monitor-probe.js';
test('rejects private, loopback, link-local and metadata addresses',()=>{for(const ip of ['127.0.0.1','10.1.1.1','169.254.169.254','192.168.1.1','172.16.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(allowedIp(ip),false,ip)});
test('accepts public routable addresses',()=>assert.equal(allowedIp('8.8.8.8'),true));
test('rejects ownership failure before network probe',async()=>{await assert.rejects(monitor('example.com','proof',{txt:async()=>[['wrong']]}),/Ownership proof/)});
test('rejects private IP returned from DNS',async()=>{await assert.rejects(monitor('example.com','proof',{txt:async()=>[['tekntandao-verification=proof']],dns4:async()=>['127.0.0.1'],dns6:async()=>[]}),/Unsafe DNS/)});
