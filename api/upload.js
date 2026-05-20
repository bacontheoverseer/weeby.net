export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { username, side, zDepth, fileName, fileContent } = req.body;
        
        const token = process.env.GITHUB_SECRET_TOKEN;
        const repoUser = process.env.GITHUB_USERNAME;
        const repoName = process.env.GITHUB_REPO_NAME;

        const safeUsername = username.replace(/[^a-zA-Z0-9]/g, "_");

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

        // 2. Save the coordinate text record layout file
        const rawModelUrl = `https://raw.githubusercontent.com/${repoUser}/${repoName}/main/rooms/${safeUsername}.gltf`;
        const registryData = { username, side, zDepth, modelUrl: rawModelUrl };

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
