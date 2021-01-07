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

const exifCommand = `exiftool -DateTimeOriginal -ee -j -q -d "%Y-%m-%d %H∶%M∶%S" .`;
const getFileInfoCommand = 'GetFileInfo -d';
const supportedExtensions = '.jpg|.jpeg|.tif|.heic|.mov|.mp4'.split('|');
let list;
let frequencies = {};

const startTime = Date.now();
// use exif tool to get info from supported files
try {
    list = execSync(exifCommand).toString();
    if(list.length) {
        JSON.parse(list);
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
    if(typeof item.DateTimeOriginal === 'undefined'){
        try {
            const fileDate = execSync(`${getFileInfoCommand} "${item.SourceFile}"`).toString();
            const [ date, time ] = fileDate.split(/\s/);
            const [ month, day, year ] = date.split(/[^\d]/);
            const [ hour, minute, second ] = time.split(/[^\d]/);
            const newDate = `${year}-${month}-${day} ${hour}∶${minute}∶${second}`;
            item.DateTimeOriginal = newDate;
        } catch (error) {
            skipped += 1;
            console.error(error, item);
        }
    }
    let newFileName = `./${item.DateTimeOriginal}${extension}`;
    // increment frequency for file name if already seen
    frequencies[newFileName] = (frequencies[newFileName] || 0) + 1;
    if (frequencies[newFileName] > 1){
        newFileName = `./${item.DateTimeOriginal} (${frequencies[newFileName]})${extension}`;
    } 
    item.NewFileName = newFileName;

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
const duration = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`${renamed ? '——\n': ''}Renamed: ${renamed}, Skipped: ${skipped}, Total: ${total}.\nTime: ${duration} sec.`);