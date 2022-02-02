const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const fs = require('fs');

// App directory
const appDirectory = fs.realpathSync(process.cwd());

const skipFiles = ['node_modules'];

function loadDirectory(dir) {
    return fs.readdirSync(dir).filter(file => skipFiles.indexOf(file) === -1 && !file.startsWith('.')).map(file => {
        return fs.statSync(path.join(dir, file)).isDirectory()
            ? {
                name: file,
                // path: path.join(dir, file),
                children: loadDirectory(path.join(dir, file)),
            }
            : {
                name: file,
                // path: path.join(dir, file),
                // size: fs.statSync(path.join(dir, file)).size,
            };
    });
}

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        contentBase: path.resolve(appDirectory, "public"),
        compress: true,
        hot: true,
        publicPath: '/',
        open: false,  // true makes it open the window every time
        // host: '0.0.0.0', // enable to access from other devices on the network
        // https: true // enable when HTTPS is needed (like in WebXR)
        before: function (app) {
            // Simple api:   (Note: if you make changes, you need to bounce the server)
            app.get('/api/read-directory', async function (req, res) {
                try {
                    console.log('DEBUG API starting', req.query, req.query.repo);
                    const repo = req.query.repo;
                    const result = await loadDirectory(repo);
                    const body = JSON.stringify(result);
                    res.send(body);
                } catch (e) {
                    res.status(500);
                    res.send(e);
                }
            });
        },
    },
});