const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const BACKUP_DIR = path.join(__dirname, '..', 'database_backups/backups.gz');
const MAX_BACKUPS = 10;
const backupMongoDB = async () => {
    console.log("Starting MongoDB backup...");
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const backupPath = path.join(BACKUP_DIR, `backup-${new Date().toISOString()}.gz`);
    const dumpCommand = `mongodump --uri="${process.env.BASE_URL}" --gzip --archive=${backupPath}`;

    exec(dumpCommand, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error during MongoDB backup: ${err}`);
            return;
        }
        console.log("MongoDB backup completed:", stdout);

        uploadBackupToS3(backupPath);
    });
};

const uploadBackupToS3 = async (backupPath) => {
    const file = fs.readFileSync(backupPath);
    const fileObj = {
        buffer: file,
        filename: path.basename(backupPath),
    };

    try {
        await cleanUpOldBackups();

        uploadedFiles.forEach((uploadedFile) => {
            console.log(`Database Backup uploaded to Azure: ${uploadedFile.fileUrl}`);
        });
    } catch (err) {
        console.error("Error uploading backup to Azure:", err);
    }
};

const cleanUpOldBackups = async () => {
    try {
        const files = await fs.promises.readdir(BACKUP_DIR);

        const backupFiles = files.filter(file => file.endsWith('.gz'));

        const sortedFiles = backupFiles.sort((a, b) => {
            const aTime = fs.statSync(path.join(BACKUP_DIR, a)).birthtimeMs;
            const bTime = fs.statSync(path.join(BACKUP_DIR, b)).birthtimeMs;
            return aTime - bTime;
        });

        if (sortedFiles.length > MAX_BACKUPS) {
            const filesToDelete = sortedFiles.slice(0, sortedFiles.length - MAX_BACKUPS);
            for (const oldBackup of filesToDelete) {
                const oldBackupPath = path.join(BACKUP_DIR, oldBackup);
                await fs.promises.unlink(oldBackupPath);
                console.log(`Deleted old backup: ${oldBackup}`);
            }
        }
    } catch (err) {
        console.error("Error cleaning up old backups:", err);
    }
};

module.exports = { backupMongoDB };