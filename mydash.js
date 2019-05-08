const spawn = require('child_process').spawn;
const dgram = require('dgram')
const server = dgram.createSocket('udp4')
const listening = new Promise((resolve) => {
    server.on('listening', resolve)
    server.bind(67)
})

const formatMacAddress = (raw) =>
{
    return [raw.substr(0, 2), raw.substr(2, 2), raw.substr(4, 2), raw.substr(6, 2), raw.substr(8, 2), raw.substr(10, 2)].join(':')
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
        node.regex  = new RegExp(node.mac);
        
        server.on('message', (msg, rinfo) =>
        {
            var data = formatMacAddress(msg.toString('hex', 28, 34));
            if (data.match(node.regex))
            {
                node.log(`event detected for mac: ${data}`);
                if (node.fired == false)
                {
                    node.fired = true;
                    node.send({mac: node.mac});
                    setTimeout(() => node.fired = false, 2000);
                }
                else
                {
                    node.log('ignore second request within 2 seconds');
                }
            }
        })
        
        node.on("close", () =>
        {
            node.status({});
        });
    }
    RED.nodes.registerType("mydash-node",MyDashNode);
}
