
let currentSong = new Audio();
let songs;
let currFolder;
let currentIndex = -1; // index of the currently loaded/playing song
// Enable debug logging to trace issues with index matching and playlist entries
const DEBUG = true;

function dbg(...args) {
    // if (DEBUG) console.log('[DEBUG]', ...args);
}

// Cache frequently used DOM nodes
const playBtn = document.getElementById("play");
const previousBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");
const seekbarEl = document.querySelector(".seekbar");
const circleEl = document.querySelector(".circle");
const songInfoEl = document.querySelector(".songinfo");
const songTimeEl = document.querySelector(".songtime");
const songlistContainer = document.querySelector(".songlist ul");
const volumeInput = document.querySelector(".range input[type=range]");

function secondsToMinutesSeconds(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}

// Format a track string into a human friendly label like "Song Name By Sujal"
function formatLabel(track) {
    if (!track) return "Unknown By Sujal";
    // Normalize backslashes to forward slashes
    let t = String(track).replace(/\\/g, '/');
    // Remove URL-encoded backslash sequence for the specific folder if present
    t = t.replace(/%5Csongs%5Cnss%5C/gi, '');
    // If currFolder is set, remove any leading path that contains it (e.g. /songs/nss/ or \songs\nss\)
    try {
        if (typeof currFolder === 'string' && currFolder.length) {
            // normalize currFolder to use forward slashes
            let cf = String(currFolder).replace(/\\/g, '/');
            // remove any leading/trailing slashes from cf
            cf = cf.replace(/^\/+|\/+$/g, '');
            // escape regex special chars
            const esc = cf.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            // build regex to remove ANY occurrence of the folder path (handles backslashes and forward slashes)
            // e.g. remove '/songs/nss/' or '\\songs\\nss\\' wherever it appears
            const folderPattern = esc.replace(/\//g, '[\\/]+');
            const removeRegex = new RegExp('[\\/]*' + folderPattern + '[\\/]*', 'gi');
            t = t.replace(removeRegex, '');
            // strip any leftover slashes
            t = t.replace(/[\\/]+/g, '');
        }
    } catch (e) {
        // ignore
    }
    // Remove everything up to the last separator (/, \\ or :) to handle weird formats like
    // "http:127.0.0.1:3000\songs\nss\Apna Bana Le By Sujal"
    let name = t.replace(/^.*[\/\:]/, '');
    // Remove querystring/hash
    name = name.split('?')[0].split('#')[0];
    // Decode percent-encoding
    try {
        name = decodeURIComponent(name);
    } catch (e) {
        try { name = decodeURI(name); } catch (e2) { /* ignore */ }
    }
    // Remove file extension
    name = name.replace(/\.mp3$/i, '');
    // Replace underscores and dashes with space
    name = name.replace(/[_-]+/g, ' ');
    name = name.trim();

    if (name === '') name = 'Unknown';
    return `${name} By Sujal`;
}

async function getsongs(folder) {//this is a function which returns us all the songs
    currFolder = folder;
    // Use current origin so it works whether you're on live-server or a different port
    let a = await fetch(`${window.location.origin}/${folder}/`)
    let response = await a.text();
    let div = document.createElement("div")//creating an empty div
    div.innerHTML = response;//div me likh rahe h gano k response
    let as = div.getElementsByTagName("a")
    songs = [];
    for (let index = 0; index < as.length; index++) {
        const element = as[index];//empty array lia h hamne
        if (element.href.endsWith(".mp3")) {
            // If the href contains the folder path, push the relative filename
            const marker = `/${currFolder}/`;
            if (element.href.includes(marker)) {
                const parts = element.href.split(marker);
                if (parts.length > 1) {
                    // take the basename from the returned part and decode any percent-encoding
                    let rel = parts[1];
                    try { rel = decodeURIComponent(rel); } catch (e) { /* ignore */ }
                    // remove any leading backslashes or slashes and any leftover folder fragments
                    rel = rel.replace(/^\\+|^\/+/, '');
                    rel = rel.replace(/^.*[\\\/]/, '');
                    songs.push(rel);
                }
            } else {
                // otherwise push the basename of the absolute href (decode percent-encoding)
                let href = element.href;
                try { href = decodeURIComponent(href); } catch (e) { /* ignore */ }
                const base = href.replace(/^.*[\\\/]/, '');
                songs.push(base);
            }
        }
    }
    // If no songs found in the directory listing, fall back to a couple of public sample tracks
    if (songs.length === 0) {
        // console.warn(`No local .mp3 files detected in ${folder} — falling back to sample tracks.`);
        songs = [
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
        ];
    }
    songlistContainer.innerHTML = "";

    for (const song of songs) {
        // `song` may be an absolute URL or a relative filename. For display, extract a
        // friendly basename, but keep the original value in the data-track attribute so
        // clicks can resolve back to the stored song entry (which may be a URL).
        const original = String(song);
        let display = original.replace(/\\/g, '/');
        display = display.replace(/%5Csongs%5Cnss%5C/gi, '');
        display = display.replace(/%20/gi, ' ');
        display = display.replace(/^.*[\/\:]/, '');
        const filenameWithExt = display;
        const filename = filenameWithExt.replace(/\.mp3$/i, '').trim();
        const label = `${filename} By Sujal`;
        const encoded = encodeURIComponent(original);
        songlistContainer.innerHTML += `<li data-track="${encoded}"><img class="invert" src="images/music.svg" alt="">
                            <div class="info">
                                <div> ${label}</div>
                            </div>
                            <div class="playnow">
                                <span>Play Now</span>
                                <img class="invert" src="images/play.svg" alt="">
                            </div></li>`;
    }

    // debug: list rendered data-track values
    dbg('getsongs() rendered items:', Array.from(songlistContainer.getElementsByTagName('li')).map(li => li.getAttribute('data-track')));
    dbg('getsongs() raw songs array:', songs.slice());

    //Attach event Listner to each song
    Array.from(songlistContainer.getElementsByTagName("li")).forEach((e, idx) => {
        e.addEventListener("click", () => {
            const encoded = e.getAttribute('data-track');
            const raw = encoded ? decodeURIComponent(encoded) : null;
            // set currentIndex based on songs array so next/previous work reliably
            if (raw) {
                // find index using robust matcher
                const found = findTrackIndex(raw);
                if (found !== -1) currentIndex = found;
                playmusic(raw);
            }
        });
    });

    // return the normalized songs array so callers can await getsongs(...) and receive it
    return songs;

}

// Visually mark the current playlist item (helps avoid ReferenceError and aids debugging)
function highlightCurrent() {
    try {
        const lis = Array.from(songlistContainer.getElementsByTagName('li'));
        lis.forEach((li, i) => {
            if (i === currentIndex) {
                // li.style.background = '#f0f8ff';
                // li.style.borderLeft = '4px solid #007acc';
            } else {
                li.style.background = '';
                li.style.borderLeft = '';
            }
        });
    } catch (e) { /* ignore */ }
}

const playmusic = (track, pause = false) => {
    dbg('playmusic called with', track);
    // let audio=newAudio("/songs/"+track)
    // Resolve track source: absolute/data URIs should be used as-is; otherwise, treat as relative to currFolder
    if (typeof track === 'string' && (track.startsWith('http') || track.startsWith('data:') || track.startsWith('/'))) {
        currentSong.src = track;
    } else {
        currentSong.src = `/${currFolder}/` + track;
    }
    dbg('playmusic resolved src', currentSong.src);
    // Update currentIndex to the matching song if possible
    try {
        const idx = findTrackIndex(track);
        if (idx !== -1) currentIndex = idx;
        dbg('playmusic matched currentIndex', currentIndex, 'for track', track);
    } catch (e) { dbg('playmusic findTrackIndex error', e); }

    if (!pause) {
        currentSong.play();
        if (playBtn) playBtn.src = "images/pause.svg";
    }
    if (songInfoEl) songInfoEl.innerHTML = formatLabel(track);
    if (songTimeEl) songTimeEl.innerHTML = "00:00/00:00";
    highlightCurrent();


}

// Helper to find the index of the currently loaded song in `songs`.
function getCurrentIndex() {
    dbg('getCurrentIndex called; currentIndex=', currentIndex, 'songs length=', (Array.isArray(songs) ? songs.length : 0), 'currentSong.src=', currentSong && currentSong.src);
    // Prefer a known currentIndex if it's in-range and appears to match the audio src
    if (typeof currentIndex === 'number' && currentIndex >= 0 && Array.isArray(songs) && currentIndex < songs.length) {
        try {
            const currSrc = (currentSong && currentSong.src) ? currentSong.src : "";
            const candidate = songs[currentIndex];
            if (candidate) {
                // Compare by last path segment (filename) which is robust across absolute/relative forms
                const candName = String(candidate).split('/').slice(-1)[0];
                const srcName = String(currSrc).split('/').slice(-1)[0];
                if (candName && srcName && (candName === srcName || currSrc.endsWith(candidate) || candidate.endsWith(srcName))) {
                    return currentIndex;
                }
            }
        } catch (e) { /* ignore and fall back to computation below */ }
    }

    if (!songs || songs.length === 0) return -1;
    const currSrc = currentSong.src || "";
    // Try exact match first
    let idx = songs.indexOf(currSrc);
    if (idx !== -1) return idx;
    // Fallback: compare by filename (last path segment)
    const currName = currSrc.split('/').slice(-1)[0];
    idx = songs.findIndex(s => {
        if (!s) return false;
        // if s is a full URL or path, compare its last segment
        const sName = s.split('/').slice(-1)[0];
        return s === currName || sName === currName || s.endsWith('/' + currName);
    });
    return idx;
}

// Robust finder: given a track string (possibly encoded, absolute or just a filename),
// try to find its index in the `songs` array by several comparisons.
function findTrackIndex(track) {
    if (!Array.isArray(songs) || songs.length === 0) return -1;
    if (!track) return -1;
    const t = String(track);
    // 1) exact match
    let idx = songs.indexOf(t);
    if (idx !== -1) return idx;

    // 2) decoded exact match
    try {
        const dec = decodeURIComponent(t);
        idx = songs.indexOf(dec);
        if (idx !== -1) return idx;
    } catch (e) { /* ignore */ }

    // 3) compare by last path segment (filename) case-insensitive
    const last = t.split('/').slice(-1)[0].toLowerCase();
    idx = songs.findIndex(s => {
        if (!s) return false;
        const sName = String(s).split('/').slice(-1)[0].toLowerCase();
        return sName === last || sName.endsWith(last) || last.endsWith(sName) || String(s).toLowerCase().endsWith('/' + last);
    });
    if (idx !== -1) return idx;

    // 4) try matching by removing any folder fragments like %5C... and using basename
    const sane = t.replace(/%5C/gi, '/').replace(/\\/g, '/').replace(/^.*[\/]/, '');
    idx = songs.findIndex(s => String(s).replace(/^.*[\/]/, '') === sane || String(s).toLowerCase().endsWith(sane.toLowerCase()));
    return idx;
}

async function displayAlbums() {
    // Fetch the root songs folder listing (show available album folders)
    try {
        let a = await fetch(`${window.location.origin}/songs/`);
        let response = await a.text();
        // create a local container to parse the directory listing HTML
        const div = document.createElement("div");
        div.innerHTML = response;
        let anchors = div.getElementsByTagName("a");
        let cardContainer = document.querySelector(".cardContainer");
        // iterate safely over the HTMLCollection and log song-folder anchors
        let array=Array.from(anchors)
        for(let index=0;index<array.length;index++){
            const e=array[index];
            if (e.href.includes("songs")) {
                let folder = e.href.split("/").splice(-2)[0].replace("%5Csongs%5C", "");
                //get the metadata of the folder
                let a = await fetch(`${window.location.origin}/songs/${folder}/info.json`);
                let response = await a.json();
                console.log(response);
                cardContainer.innerHTML = cardContainer.innerHTML + `<div data-folder="${folder}" class="card ">
                        <div class="play">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"
                                fill="none" stroke="black">
                                <path
                                    d="M18.8906 12.846C18.5371 14.189 16.8667 15.138 13.5257 17.0361C10.296 18.8709 8.6812 19.7884 7.37983 19.4196C6.8418 19.2671 6.35159 18.9776 5.95624 18.5787C5 17.6139 5 15.7426 5 12C5 8.2574 5 6.3861 5.95624 5.42132C6.35159 5.02245 6.8418 4.73288 7.37983 4.58042C8.6812 4.21165 10.296 5.12907 13.5257 6.96393C16.8667 8.86197 18.5371 9.811 18.8906 11.154C19.0365 11.7084 19.0365 12.2916 18.8906 12.846Z"
                                    stroke-width="1.5" stroke-linejoin="round"></path>
                            </svg>
                        </div>

                        <img src="/songs/${folder}/cover.jpg"
                            alt="">
                        <h2>${response.title}</h2>
                        <p>${response.description}</p>
                    </div>`

            }
        }

        //load the playlist whenever the card is clicked
        Array.from(document.getElementsByClassName("card")).forEach((e) => {
            // console.log(e);
            e.addEventListener("click", async item => {
                // console.log(item.currentTarget, item.currentTarget.dataset)
                songs = await getsongs(`songs/${item.currentTarget.dataset.folder}`)
                playmusic(songs[0]);
                // Reset/initialize currentIndex for the new folder and preload the first track paused
                currentIndex = -1;
                if (Array.isArray(songs) && songs.length > 0) {
                    currentIndex = 0;
                    // preload first track (paused)
                    playmusic(songs[0]);
                }

            })
        })
        // console.log(anchors);
        // console.log('displayAlbums parsed listing:', div);
        // TODO: render album cards from `div` if desired
    } catch (e) {
        console.warn('displayAlbums failed to fetch /songs/:', e);
    }


}
async function main() {

    // Get the list of all the songs.
    await getsongs("songs/nss")

    //Display all the albums on the page
    displayAlbums();


    // Normalize song entries so local files become simple filenames and
    // absolute URLs/data URIs are preserved. This prevents folder prefixes
    // like http://127.0.0.1:3000/\songs\nss\ from appearing in labels.
    function cleanTrackForStorage(track) {
        if (!track) return track;
        let t = String(track);
        // normalize backslashes
        t = t.replace(/\\/g, '/');
        // Remove URL-encoded folder pattern if present
        t = t.replace(/%5Csongs%5Cnss%5C/gi, '');
        // If absolute URL or data URI or already absolute path, try to extract the filename after currFolder if present
        const marker = `/${currFolder}/`;
        if (/^https?:\/\//i.test(t) || /^data:/i.test(t) || /^\//.test(t)) {
            if (t.includes(marker)) {
                // If the URL contains the currFolder marker, store the part after it (relative filename)
                return t.split(marker).pop();
            }
            // Preserve absolute URLs/data URIs as-is (do not strip protocol/host). This prevents
            // sample fallback tracks or remote URLs from being converted into bare filenames.
            return t;
        }
        // Otherwise take last path segment using any separator (/, \ or :)
        return t.replace(/^.*[\/\:]/, '');
    }

    songs = songs.map(cleanTrackForStorage);
    // playmusic(songs[0], true);  
    // console.log('Normalized songs array:', songs);


    //Show all the songs in the playlist


    //Attach an event list for play prev and next
    if (playBtn) {
        playBtn.addEventListener("click", () => {
            if (currentSong.paused) {
                currentSong.play();
                playBtn.src = "images/pause.svg";
            }
            else {
                currentSong.pause();
                playBtn.src = "images/play.svg";
            }
        });
    }

    //listen for timeupdate event
    currentSong.addEventListener("timeupdate", () => {
        const cur = currentSong.currentTime || 0;
        const dur = currentSong.duration || 0;
        if (songTimeEl) songTimeEl.innerHTML = `${secondsToMinutesSeconds(cur)} : ${secondsToMinutesSeconds(dur)}`;
        if (circleEl) {
            const pct = dur ? (cur / dur) * 100 : 0;
            circleEl.style.left = pct + "%";
        }
    })

    //Add an event listener to seekbar
    if (seekbarEl) {
        seekbarEl.addEventListener("click", e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            if (circleEl) circleEl.style.left = percent + "%";
            if (currentSong.duration) currentSong.currentTime = ((currentSong.duration) * percent) / 100;
        });
    }

    //Add an event listner for hamburger
    const hamburger = document.querySelector(".hamburger");
    if (hamburger) hamburger.addEventListener("click", () => {
        document.querySelector(".left").style.left = "0"
    })

    //Add an event listner for closeButton
    const closeBtn = document.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener("click", () => {
        document.querySelector(".left").style.left = "-120%"
    })

    // Add an event listener to previous
    if (previousBtn) previousBtn.addEventListener("click", () => {
        console.log("Previous clicked");
        const index = getCurrentIndex();
        if (index > 0) {
            playmusic(songs[index - 1]);
        } else {
            // if at start, restart current song
            currentSong.currentTime = 0;
            currentSong.play();
            if (playBtn) playBtn.src = "images/pause.svg";
        }
    })

    // Add an event listener to next
    if (nextBtn) nextBtn.addEventListener("click", () => {
        console.log("Next clicked");
        const index = getCurrentIndex();
        if (index >= 0 && (index + 1) < songs.length) {
            playmusic(songs[index + 1]);
        }
    })
    //Add an event to Volume
    // Initialize volume control
    if (volumeInput) {
        volumeInput.min = 0;
        volumeInput.max = 100;
        volumeInput.value = 50;
        currentSong.volume = 0.5;
        volumeInput.addEventListener("input", (e) => {
            const v = parseInt(e.target.value, 10) || 0;
            // console.log("setting volume to", v, "/100");
            currentSong.volume = v / 100;
        });
    }

    //Add an event listner to mute the track
    document.querySelector(".volume>img").addEventListener("click",e=>{
        console.log(e.target);
        if(e.target.src.includes("images/volume.svg")){
            e.target.src="images/mute.svg";
            currentSong.muted=true;
            document.querySelector(".range input[type=range]").value=0; 
        }else{
            e.target.src="images/volume.svg";
            currentSong.muted=false;
            document.querySelector(".range input[type=range]").value=50;
        }
    })


    // If there is at least one song, load it (paused)
    if (songs.length > 0) {
        playmusic(songs[0], true);
    }
}

// Start
main();