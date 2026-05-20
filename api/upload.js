// Serverless cloud handler to route incoming JSON requests safely to GitHub endpoints
export default async function handler(req, res) {
    // Enable Cross-Origin Resource Sharing (CORS) so your frontend can communicate securely
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { username, side, zDepth, fileName, fileContent } = req.body;
        
        // Grab environment variables safely stored in your Vercel dashboard configuration panels
        const token = process.env.GITHUB_SECRET_TOKEN;
        const repoUser = process.env.GITHUB_USERNAME;
        const repoName = process.env.GITHUB_REPO_NAME;

        if (!token || !repoUser || !repoName) {
            return res.status(500).send("Missing cloud backend authorization variables.");
        }

        const safeUsername = username.replace(/[^a-zA-Z0-9]/g, "_");

        // 1. Send the huge 3D room asset file to GitHub
        const uploadFileUrl = `https://api.github.com/repos/${repoUser}/${repoName}/contents/rooms/${safeUsername}.gltf`;
        const filePayload = {
            message: `Archive 3D model file for user: ${username}`,
            content: fileContent // Raw base64 string package
        };

        const fileResponse = await fetch(uploadFileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filePayload)
        });

        if (!fileResponse.ok) {
            const errorText = await fileResponse.text();
            return res.status(400).send(`GitHub Storage Rejected Asset: ${errorText}`);
        }

        // 2. Generate the lightweight metadata JSON record file 
        const rawModelUrl = `https://raw.githubusercontent.com/${repoUser}/${repoName}/main/rooms/${safeUsername}.gltf`;
        const registryData = {
            username: username,
            side: side,
            zDepth: zDepth,
            modelUrl: rawModelUrl
        };

        const uploadRegistryUrl = `https://api.github.com/repos/${repoUser}/${repoName}/contents/registry/${safeUsername}.json`;
        const registryPayload = {
            message: `Register entry marker configuration for player: ${username}`,
            content: Buffer.from(JSON.stringify(registryData, null, 2)).toString('base64')
        };

        const registryResponse = await fetch(uploadRegistryUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registryPayload)
        });

        if (registryResponse.ok) {
            return res.status(200).send("Registration Successful");
        } else {
            return res.status(400).send("Model uploaded, but directory record compilation failed.");
        }

    } catch (error) {
        return res.status(500).send(`Internal Server Processing Error: ${error.message}`);
    }
}