<?php
/**
 * Picks a specified number of random filenames from a given file.
 *
 * @param string $filepath The path to the file containing filenames.
 * @param int $count The number of random filenames to pick. Default is 7.
 * @return array An array of randomly picked filenames.
 */
function pickRandomFilenames($filepath, $count = 7) {
    if (!file_exists($filepath) || !is_readable($filepath)) {
        return [];
    }

    $lines = file($filepath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (empty($lines)) {
        return [];
    }

    $total = count($lines);
    if ($count > $total) {
        $count = $total;
    }

    $randomKeys = array_rand($lines, $count);
    // array_rand returns a single int if $count == 1
    if ($count === 1) {
        return [$lines[$randomKeys]];
    }
    $result = [];
    foreach ($randomKeys as $key) {
        $result[] = $lines[$key];
    }
    return $result;
}

// Define the path to the file containing filenames
$filenameFile = '/home/tudor/scripts/pictures.txt';
$files = pickRandomFilenames($filenameFile, 8);
?><!DOCTYPE html>
<html lang="ro">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="1800"> <!-- Refresh every 30 minutes -->
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="apple-touch-icon" href="touch-icon-ipad.png">
    <link rel="icon" type="image/png" href="touch-icon-ipad.png">
    <title>Rama foto</title>
    <style>
        html,
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            overflow: hidden;
            position: relative;
            font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            font-size: 120%;
            -webkit-overflow-scrolling: none;
            overscroll-behavior-y: none;
        }

        #front {
            text-align: center;
            z-index: 2;
        }

        .frame {
            background-color: #fff;
            border: 2vw solid #fff;
            border-radius: 10px;
            box-shadow: 0 0 15px rgba(0, 0, 0, .3);
            position: absolute;
            top: 50%;
            left: 50%;
            overflow: hidden;
        }

        .frame label {
            position: absolute;
            bottom: 0;
            left: 0;
            padding: .5rem;
            text-align: left;
            color: #fff;
            text-shadow: 2px 2px 2px #000;
            opacity: .8;
        }

        .frame label.right-side {
            text-align: right;
            right: 0;
        }

        #front .frame img {
            max-width: 90vw;
            max-height: 90vh;
        }

        #backdrop img {
            filter: grayscale(100%) contrast(110%) opacity(0.85);
            max-height: 80vh;
        }

        #clock {
            color: #fff;
            font-size: 250%;
            text-shadow: 2px 2px 5px #000;
            padding: 1rem 2rem;
            position: fixed;
            background: rgba(0, 0, 0, .6);
            border-radius: 0 1rem 1rem 0;
        }

        #clock.right-side {
            border-radius: 1rem 0 0 1rem;
        }

        #loader {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            background: #1e1e1e;
            color: rgb(163, 163, 163);
            font-size: 120%;
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-user-select: none;
            user-select: none;
            transition: opacity 0.5s ease-in-out;
        }

        #loader.hidden {
            opacity: 0;
            pointer-events: none;
        }
    </style>
    <script>
        /**
         * Generates a random integer between min (inclusive) and max (exclusive).
         * @param {number} min - The minimum value (inclusive).
         * @param {number} max - The maximum value (exclusive).
         * @returns {number} A random integer between min and max.
         */
        function rnd(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }

        /**
         * Extracts the date from a filename and formats it to a human-readable string.
         * @param {string} filename - The filename containing a date.
         * @returns {string} A formatted date string in 'ro-RO' locale.
         */
        var dateRegexp = /(\d{4}-\d{2}-\d{2})/;

        function getDateFromFilename(filename) {
            if (dateRegexp.test(filename) === false) {
                console.error('Filename contains no date:', filename);
                return '';
            }
            var dateStr = filename.match(dateRegexp)[0];
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) {
                console.error('Invalid date in filename:', {
                    filename,
                    dateStr
                });
                return '';
            }
            return d.toLocaleString('ro-RO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        /**
         * Constructs the image path.
         * @param {string} filePath - The received file path.
         * @returns {string} The full image path.
         */
        function getPathFromFilename(filePath) {
            var prefix = '/sabina';
            var dateParts = filePath.split('/');
            if(dateParts[0].startsWith('.')){
                dateParts[0] = prefix;
            } else {
                dateParts.unshift(prefix);
            }
            return dateParts.join('/');
        }

        /**
         * Creates a frame element containing an image and its label.
         * @param {string} filename - The filename to be used for the image and label.
         * @returns {HTMLElement} A div element representing the frame with an image and label.
         */
        function createFrameElement(filename, hasLabel = true) {
            var frame = document.createElement('div');
            frame.className = 'frame';
            frame.appendChild(createImageElement(filename));
            if (hasLabel) frame.appendChild(createImageLabel(filename));
            return frame;
        }

        function onFrameClick(event) {
            var target = event.target;
            if (target.tagName.toLowerCase() !== 'div' || !target.classList.contains('frame')) {
                target = target.closest('.frame');
            }
            if (!target) return;

            var rotation = parseFloat(target.parentElement.getAttribute('data-rotation'));
            rotation += 90;
            target.parentElement.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
            target.parentElement.setAttribute('data-rotation', rotation);
        }

        var toLoad = [];

        /**
         * Creates an image element with the source set to the path received.
         * @param {string} filePath - The file path to be used for the image source.
         * @returns {HTMLImageElement} An image element with the specified source and alt text.
         */
        function createImageElement(filePath) {
            toLoad.push(filePath);
            var img = new Image();
            img.onload = function () {
                onImageLoad(filePath);
            };
            img.alt = getDateFromFilename(filePath);
            img.src = getPathFromFilename(filePath);
            return img;
        }

        function onImageLoad(filename) {
            toLoad = toLoad.filter(f => f !== filename);
            if (toLoad.length === 0) {
                document.getElementById('loader').classList.add('hidden');
            }
        }

        /**
         * Creates a label element displaying the date extracted from the filename.
         * @param {string} filename - The filename to extract the date from.
         * @returns {HTMLLabelElement} A label element with the formatted date text.
         */
        function createImageLabel(filename) {
            if (filename.trim().length === 0) {
                console.error('Empty filename provided:', filename);
                return null;
            }
            var dateText = document.createElement('label');
            dateText.textContent = getDateFromFilename(filename);
            return dateText;
        }

        /**
         * Updates the clock element with the current time in 'Europe/Bucharest' timezone.
         */
        function updateClock() {
            var clock = document.getElementById('clock');
            if (!clock) return;
            var now = new Date();
            var options = {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Europe/Bucharest'
            };

            var nowText = now.toLocaleTimeString('ro-RO', options);
            if (clock.textContent !== nowText) {
                clock.textContent = nowText;
            }
        }

        // Update the clock every 900 milliseconds
        setInterval(updateClock, 900);

        // Reload the page on click
        document.addEventListener('click', function () {
            window.location.reload();
        });

        /**
         * Renders the photo frame by creating and positioning image frames based on the provided file list.
         * The first image is displayed in the front, and the rest are positioned in the backdrop.
         * @param {Array<string>} files - An array of filenames to be displayed in the photo frame.
         */
        function render(files) {
            var clockElement = document.getElementById('clock');
            clockElement.style.top = `${rnd(20, 81)}%`;
            var flipSide = rnd(0, 2);
            if (flipSide) {
                clockElement.classList.add('right-side');
                clockElement.style.right = '0';
            }
            updateClock();

            var backdropElement = document.getElementById('backdrop');
            var frontElement = document.getElementById('front');

            // first image is the front image
            // var randomIndex = rnd(0, files.length);
            var frontImage = files.shift();

            // create the front image
            var frontFrameEl = createFrameElement(frontImage);
            var randomRotation = rnd(-5, 5);
            frontFrameEl.style.transform = `translate(-50%, -50%) rotate(${randomRotation}deg)`;
            frontFrameEl.setAttribute('data-rotation', randomRotation);
            if (randomRotation < 0) {
                frontFrameEl.getElementsByTagName('label')[0].classList.add('right-side');
            }
            frontElement.appendChild(frontFrameEl);

            var backdropPositions = [{
                top: '-20%',
                left: '60%'
            }, {
                top: '50%',
                left: '50%'
            }, {
                top: '50%',
                left: '0'
            }, {
                top: '-20%',
                left: '-20%'
            }, {
                top: '25%',
                left: '-20%'
            }, {
                top: '25%',
                left: '70%'
            }, {
                top: '-20%',
                left: '0'
            }];

            for (var i = 0; i < files.length; i++) {
                var filename = files[i];
                var frameEl = createFrameElement(filename, false);
                var rotation = rnd(-90, 91);
                frameEl.style.transform = `rotate(${rotation}deg)`;
                var pos = backdropPositions[i %
                    backdropPositions.length];
                frameEl.style.top = pos.top;
                frameEl.style.left = pos.left;
                frameEl.setAttribute('data-rotation', rotation);
                backdropElement.appendChild(frameEl);
            }
        }
    </script>
</head>

<body>
    <div id="backdrop"></div>
    <div id="front"></div>
    <div id="loader">Se încarcă imaginile...</div>
    <div id="clock"></div>

    <script>
        var files = <?php echo json_encode($files, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
        render(files);
    </script>
</body>

</html>
