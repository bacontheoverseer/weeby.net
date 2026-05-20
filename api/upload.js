export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // --- NEW: THE SERVERLESS CORS PROXY PASSTHROUGH BRIDGE ---
    if (req.method === 'GET' && req.query.proxyUrl) {
        try {
            const targetUrl = decodeURIComponent(req.query.proxyUrl);
            
            // Safety Check: Only proxy official Rec Room network domains
            if (!targetUrl.includes('rec.net')) {
                return res.status(403).send('Forbidden: Target domain must be an official rec.net node.');
            }

            const proxyResponse = await fetch(targetUrl);
            if (!proxyResponse.ok) {
                return res.status(proxyResponse.status).send(`RecNet API Response Error`);
            }

            // Determine if payload is an image binary or standard JSON string configuration
            const contentType = proxyResponse.headers.get('content-type') || '';
            if (contentType.includes('application/json') || contentType.includes('text/')) {
                const textData = await proxyResponse.text();
                res.setHeader('Content-Type', contentType);
                return res.status(200).send(textData);
            } else {
                // Handle raw image binary buffers (JPG/PNG formats) safely
                const arrayBuffer = await proxyResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                res.setHeader('Content-Type', contentType);
                return res.status(200).send(buffer);
            }
        } catch (proxyErr) {
            return res.status(500).send(`Proxy exception error: ${proxyErr.message}`);
        }
    }
    // --------------------------------------------------------

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { username, side, zDepth, fileName, fileContent } = req.body;
        
        const token = process.env.GITHUB_SECRET_TOKEN;
        const repoUser = process.env.GITHUB_USERNAME;
        const repoName = process.env.GITHUB_REPO_NAME;

        const safeUsername = username.replace(/[^a-zA-Z0-9]/g, "_");

        // Fetch live avatar URL path via internal API logic for layout registration
        let avatarUrl = "https://img.rec.net/default_avatar.png"; 
        try {
            const accountRes = await fetch(`https://accounts.rec.net/account?username=${encodeURIComponent(username)}`);
            if (accountRes.ok) {
                const accountData = await accountRes.json();
                if (accountData && accountData.accountId) {
                    avatarUrl = `https://api.rec.net/api/images/v4/avatar?accountId=${accountData.accountId}`;
                }
            }
        } catch (apiErr) {
            console.error("Rec.net background fetch failed, reverting to asset fallback.");
        }

        // 1. Upload the massive 3D model directly into GitHub's larger payload pipes
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

        // 2. Save the coordinate text record layout file including the static avatar link maps
        const rawModelUrl = `https://raw.githubusercontent.com/${repoUser}/${repoName}/main/rooms/${safeUsername}.gltf`;
        const registryData = { username, side, zDepth, modelUrl: rawModelUrl, avatarUrl: avatarUrl };

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
