export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // The Serverless CORS Proxy (Handles image data conversion cleanly)
    if (req.method === 'GET' && req.query.proxyUrl) {
        try {
            const targetUrl = decodeURIComponent(req.query.proxyUrl);
            
            if (!targetUrl.includes('rec.net')) {
                return res.status(403).send('Forbidden: Target domain must be an official rec.net node.');
            }

            const proxyResponse = await fetch(targetUrl);
            if (!proxyResponse.ok) {
                return res.status(proxyResponse.status).send(`RecNet API Response Error`);
            }

            const contentType = proxyResponse.headers.get('content-type') || '';
            if (contentType.includes('application/json') || contentType.includes('text/')) {
                const textData = await proxyResponse.text();
                res.setHeader('Content-Type', contentType);
                return res.status(200).send(textData);
            } else {
                const arrayBuffer = await proxyResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                res.setHeader('Content-Type', contentType);
                return res.status(200).send(buffer);
            }
        } catch (proxyErr) {
            return res.status(500).send(`Proxy exception error: ${proxyErr.message}`);
        }
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { username, side, zDepth, fileName, fileContent, avatarUrl } = req.body;
        
        const token = process.env.GITHUB_SECRET_TOKEN;
        const repoUser = process.env.GITHUB_USERNAME;
        const repoName = process.env.GITHUB_REPO_NAME;

        const safeUsername = username.replace(/[^a-zA-Z0-9]/g, "_");
        const finalAvatarUrl = avatarUrl || "https://img.rec.net/default_avatar.png";

        // 1. Store the .gltf room assembly file
        const uploadFileUrl = `https://api.github.com/repos/${repoUser}/${repoName}/contents/rooms/${safeUsername}.gltf`;
        
        const fileResponse = await fetch(uploadFileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'WeebyHostMuseum'
            },
            body: JSON.stringify({
                message: `Preserve Room Model: ${username}`,
                content: fileContent
            })
        });

        if (!fileResponse.ok) {
            const errDetails = await fileResponse.text();
            return res.status(400).send(`GitHub File Storage Error: ${errDetails}`);
        }

        // 2. Save layout registry profile
        const rawModelUrl = `https://raw.githubusercontent.com/${repoUser}/${repoName}/main/rooms/${safeUsername}.gltf`;
        const registryData = { username, side, zDepth, modelUrl: rawModelUrl, avatarUrl: finalAvatarUrl };

        const uploadRegistryUrl = `https://api.github.com/repos/${repoUser}/${repoName}/contents/registry/${safeUsername}.json`;
        
        const registryResponse = await fetch(uploadRegistryUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'WeebyHostMuseum'
            },
            body: JSON.stringify({
                message: `Register Corridor Layout Node: ${username}`,
                content: Buffer.from(JSON.stringify(registryData, null, 2)).toString('base64')
            })
        });

        if (registryResponse.ok) {
            return res.status(200).send("Registration Completed Successfully");
        } else {
            return res.status(400).send("Model saved, but index layout mapping failed.");
        }

    } catch (error) {
        return res.status(500).send(`Internal system network exception: ${error.message}`);
    }
}
