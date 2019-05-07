const spawn = require('child_process').spawn;
var unbufferExec = require('child_process').spawnSync('which', ['unbuffer'], {encoding: 'utf8'});
var tcpdumpExec = require('child_process').spawnSync('which', ['tcpdump'], {encoding: 'utf8'});
if (unbufferExec.stdout != "" || tcpdumpExec.stdout != "")
{
    unbufferExec = unbufferExec.stdout.replace(/\n/, '');
    tcpdumpExec = tcpdumpExec.stdout.replace(/\n/, '');
}
const filter = 'arp[6:2]&0x0001=1';
var scan = spawn(unbufferExec, [tcpdumpExec, '-t', '-e', '-n', '-q', '-K', '-U', '-Q', 'In', '-i', 'any', filter]);

const getTcpDumpProcess = (node) =>
{
    node.log(`getTcpDumpProcess() mac[${node.mac}]`);
    if (unbufferExec != "" || tcpdumpExec != "")
    {
        if (scan && scan.killed === true)
        {
            node.log(`tcpdump killed, restarting`);
            scan = spawn(unbufferExec, [tcpdumpExec, '-t', '-e', '-n', '-q', '-K', '-U', '-Q', 'In', '-i', 'any', filter]);
            return;
        }
        else
        {
            node.log(`tcpdump alive. pid[${scan.pid}]`);
            return;
        }
    }
    else
    {
        node.error(`error starting tcpdump. unbuffer[${unbufferExec}] tcpdump[${tcpdumpExec}]`);
    }
}

module.exports = (RED) =>
{
    function MyDashNode(n)
    {
        RED.nodes.createNode(this,n);
        var node    = this;
        node.fired  = false;
        node.mac    = n.mac;
        if (node.mac == "" || node.mac.match(/^[^0-9a-f:]+$/))
        {
            node.error(`no valid MAC given [${node.mac}]`);
            node.status({fill:`red`,shape:`dot`,text:`no MAC given`});
            return;
        }
        getTcpDumpProcess(node);
        node.regex  = new RegExp(node.mac);

        if (scan && scan.killed === false)
        {
            node.log('tcpdump alive, attaching event listener');
            node.status({fill:`green`,shape:`ring`,text:`waiting ${node.mac}`});
            scan.stdout.on("data", (d) =>
            {
                var data = d.toString();
                if (data.match(node.regex))
                {
                    if (node.fired == false)
                    {
                        node.fired = true;
                        node.send({mac: node.mac});
                        setTimeout(() => node.fired = false, 2000);
                    }
                    else
                    {
                        node.log('ignore second arp request within 2 seconds');
                    }
                }
            });
            scan.on("close", () =>
            {
                if (scan.killed === true)
                {
                    node.error('tcpdump killed');
                    node.status({fill:`red`,shape:`dot`,text:`tcpdump stopped`});
                }
            });
        }
        else
        {
            node.error(`tcpdump not running, will not attach event listener`);
            node.status({fill:`red`,shape:`dot`,text:`tcpdump not running`});
        }
        
        node.on("close", () =>
        {
            node.status({});
            if (scan.killed === false)
            {
                node.log(`stopping tcpdump`);
                scan.kill();
            }
        });
    }
    RED.nodes.registerType("mydash-node",MyDashNode);
}
