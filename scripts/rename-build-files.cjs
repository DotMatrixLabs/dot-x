const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'msi');
const targetBaseName = 'dot-x.windows-x86_64';

function renameBuildFiles() {
  try {
    if (!fs.existsSync(buildDir)) {
      console.error(`Build directory not found: ${buildDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(buildDir);
    console.log(`Found ${files.length} files in build directory`);

    // Get file stats and sort by modification time (newest first)
    const filesWithStats = files
      .map(file => {
        const filePath = path.join(buildDir, file);
        const stats = fs.statSync(filePath);
        return { name: file, path: filePath, stats };
      })
      .filter(item => item.stats.isFile())
      .sort((a, b) => b.stats.mtime - a.stats.mtime);

    // Take only the 3 newest files
    const newestFiles = filesWithStats.slice(0, 3);
    console.log(`Processing ${newestFiles.length} newest files`);

    newestFiles.forEach(fileItem => {
      const file = fileItem.name;
      const filePath = fileItem.path;
      const stats = fileItem.stats;
      
      const ext = path.extname(file);
      let newFileName;
      
      // Determine the new filename based on the extension
      if (ext === '.msi') {
        newFileName = `${targetBaseName}.msi`;
      } else if (ext === '.zip') {
        newFileName = `${targetBaseName}.msi.zip`;
      } else if (ext === '.sig') {
        // Check if it's a .msi.zip.sig or just .msi.sig
        if (file.includes('.msi.zip.sig')) {
          newFileName = `${targetBaseName}.msi.zip.sig`;
        } else if (file.includes('.msi.sig')) {
          newFileName = `${targetBaseName}.msi.sig`;
        } else {
          newFileName = `${targetBaseName}${ext}`;
        }
      } else {
        newFileName = `${targetBaseName}${ext}`;
      }

      const newFilePath = path.join(buildDir, newFileName);
      
      if (file !== newFileName) {
        console.log(`Renaming: ${file} -> ${newFileName}`);
        fs.renameSync(filePath, newFilePath);
      } else {
        console.log(`File already has correct name: ${file}`);
      }
    });

    console.log('File renaming completed successfully!');
  } catch (error) {
    console.error('Error renaming files:', error);
    process.exit(1);
  }
}

renameBuildFiles(); 