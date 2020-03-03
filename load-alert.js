#!/usr/bin/env node

const os = require('os');
const childProc = require('child_process');

const cpuCount = os.cpus().length;
const maxUsage = 90; // 90% CPU average over 5 min
const threshold = (cpuCount * maxUsage / 100).toFixed(2);
const loadAvg = os.loadavg().map(v => v.toFixed(2));
const listLimit = 10;
const whiteSpaceRegex = /\s+/;

const procListCommand = `ps -eo user,%cpu,%mem,start_time,args --sort=-%cpu | head -${listLimit}`;
const memListCommand = `ps -eo user,%cpu,%mem,start_time,args --sort=-%mem | head -${listLimit}`;
const mailCommand = '/usr/sbin/sendmail -t';
const usersCommand = '/usr/bin/w -s';
const diskCommand = '/bin/df -hTBG -x tmpfs -x devtmpfs -x debugfs';
// compare to the 5 min average
const isOverThreshold = loadAvg[1] > threshold;
if(isOverThreshold) {
	const topProcList = childProc.execSync(procListCommand).toString();
	// const columnNames = topProcList[0].split(whiteSpaceRegex);
	const topMemList = childProc.execSync(memListCommand).toString();
	const users = childProc.execSync(usersCommand).toString();
	const diskUsage = childProc.execSync(diskCommand).toString();

	const message = `To: tudor.iordachescu@gmail.com
From: load-alert
Subject: [${os.hostname()}] CPU load exceeded!
Content-Type: text/html
MIME-Version: 1.0

<pre style="font-family:Hasklig, 'Source Code Pro', Consolas, monospace; font-size: 14px">
* Average load: 1 min: ${loadAvg[0]}, 5 min: ${loadAvg[1]}, 15 min: ${loadAvg[1]}

* Top 10 by CPU:
${topProcList}

* Top 10 by memory:
${topMemList}

* Users:
${users}

* Disk:
${diskUsage}
</pre>
`;
	// console.log(message);
	childProc.execSync(mailCommand, {input: message});
}
