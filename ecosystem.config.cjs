// PM2 ecosystem file for production deployment
module.exports = {
    apps: [{
        name: 'dracin',
        script: './dist/server/entry.mjs',
        instances: 1,
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            HOST: '0.0.0.0',
            PORT: 4321
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s'
    }]
};
