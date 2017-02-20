var DEFAULT_RECORDING_SESSION_NAME = "Recording Session";

function setStorage(name, value) {
    try {
        if (window.sessionStorage) {
            window.sessionStorage.setItem(name, value);
        }

        if (window.localStorage) {
            window.localStorage.setItem(name, value);
        }
    } catch(e) {
        console.log("localStorage not avail");
    }
}

function getStorage(name) {
    var value = undefined;

    try {

        // First try session, then local
        if (window.sessionStorage) {
            value = window.sessionStorage.getItem(name);
        }

        if (!value && window.localStorage) {
            value = window.localStorage.getItem(name);
        }

    } catch(e) {
        console.log("localStorage not avail");
    }

    return value;
}

function delStorage(name) {
    try {

        if(window.sessionStorage)
            window.sessionStorage.removeItem(name);

        if(window.localStorage)
            window.localStorage.removeItem(name);

    } catch(e) {
        console.log("localStorage not avail");
    }
}