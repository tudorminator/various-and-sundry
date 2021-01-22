#! /usr/local/bin/node

/**
 * Renames all the files in the current folder using EXIF creation date.
 * Resulting file format: `YYYY-mm-dd H∶M∶S (i).ext`
 * Supported file extensions: .jpg, .jpeg, .tif, .heic, .mov, .mp4
 * 
 * Usage: cd to directory containing the files to be renamed (!!! very important !!!),
 * then run `node /path/to/exifRename.mjs`,
 * or simply `/path/to/exifRename.mjs` if you make it executable before (`chmode +x`)
 */

import { execSync } from 'child_process';
import { exit } from 'process';
import { extname } from 'path';
import { renameSync, existsSync } from 'fs';
import readline from 'readline';

const exifProp = 'DateCreated';
// const exifProp = 'DateTimeOriginal';
const exifCommand = `exiftool -${exifProp} -ee -j -q -d "%Y-%m-%d %H∶%M∶%S" .`;
const getFileInfoCommand = 'GetFileInfo -d';
const supportedExtensions = '.jpg|.jpeg|.tif|.heic|.png|.mov|.mp4'.split('|');
let list;
let frequencies = {};

const startTime = Date.now();
// use exif tool to get info from supported files
try {
    list = execSync(exifCommand).toString();
    if(list.length) {
        list = JSON.parse(list);
    } else {
        console.error('No files found.');
        process.exit(1);    
    }
} catch (error) {
    console.error(error);
    process.exit(1);
}

const total = list.length;
if(total === 0){
    console.error('No files found.');
    process.exit(1);
}

let renamed = 0;
let skipped = 0;
// filter out unsupported extensions
list = list.filter(item => {
  const ext = extname(item.SourceFile).toLowerCase();
  if(supportedExtensions.includes(ext)){
    return true;
  } else {
    skipped += 1;
    return false;
  }
});

if(list.length === 0){
  console.error('No supported files found.');
  process.exit(1);
}

// first pass: compute frequencies and new file names
list.forEach(item => {
    // check extension
    const extension = extname(item.SourceFile).toLowerCase();
    // bail out if unsupported
    if(!supportedExtensions.includes(extension)){
        // console.error(`Unsupported file type: ${item.SourceFile}`);
        skipped += 1;
        return;
    }
    // use GetFileInfo for files that were not supported by exif tool
    if(typeof item[exifProp] === 'undefined'){
        try {
            const fileDate = execSync(`${getFileInfoCommand} "${item.SourceFile}"`).toString();
            const [ date, time ] = fileDate.split(/\s/);
            const [ month, day, year ] = date.split(/[^\d]/);
            const [ hour, minute, second ] = time.split(/[^\d]/);
            const newDate = `${year}-${month}-${day} ${hour}∶${minute}∶${second}`;
            item[exifProp] = newDate;
        } catch (error) {
            skipped += 1;
            console.error(error, item);
        }
    }
    let newFileName = `./${item[exifProp]}${extension}`;
    // increment frequency for file name if already seen
    frequencies[newFileName] = (frequencies[newFileName] || 0) + 1;
    if (frequencies[newFileName] > 1){
        newFileName = `./${item[exifProp]} (${frequencies[newFileName]})${extension}`;
    } 
    item.NewFileName = newFileName;
});
const firstPassEnd = Date.now();

// filter out files where the new name is the same as old name
list = list.filter(item => {
  if(item.SourceFile !== item.NewFileName){
    return true;
  } else {
    skipped += 1;
    return false;
  }
});
if(list.length === 0) {
  console.error('All files are properly named. Aborting.');
  process.exit(1);
}

// second pass: display renaming preview and ask for confirmation
console.log('Attempting rename:');
console.table(list, ['SourceFile', 'NewFileName']);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.question('\nProceed? [y/N] ', (answer = 'n') => {
  if(answer.toLowerCase() === 'y'){
    // third pass: do rename
    const renameStartTime = Date.now();
    list.forEach(item => {
      // rename files if there's a new name and if it's different
      if (!item.NewFileName || item.SourceFile === item.NewFileName) {
        // console.error(`Skipping: ${item.SourceFile}`);
        skipped += 1;
        return;
      }
      // check if a file with desired new name already exists and bail out, otherwise renameSync would overwrite it
      if(existsSync(item.NewFileName)){
          console.error(`Error: A file ${item.NewFileName} already exists!`);
          skipped += 1;
          return;
      }
      // finally do rename
      try {
          renameSync(item.SourceFile, item.NewFileName);
          console.log(`Renaming: ${item.SourceFile} → ${item.NewFileName}`);
          renamed += 1;
      } catch (error) {
          skipped += 1;
          console.error(error);
      }
    });
    const firstPassDuration = (firstPassEnd - startTime) / 1000;
    const renamePassDuration = (Date.now() - renameStartTime) / 1000;
    const totalDuration = (firstPassDuration + renamePassDuration).toFixed(1);
    console.log(`${renamed ? '——\n': ''}Renamed: ${renamed}, Skipped: ${skipped}, Total: ${total}.\nTime: ${totalDuration} sec.`);
  } else {
    console.log('Aborted.');
    process.exit(0);
  }
  rl.close();
})