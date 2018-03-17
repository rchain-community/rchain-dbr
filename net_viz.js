function makeSocialNetwork(makeXHR) {
    function fetch() {
	return new Promise(function (resolve, reject) {
	    const xhr = makeXHR();
	    xhr.open("GET", "aux/trust_net");
	    xhr.onload = function () {
		if (this.status >= 200 && this.status < 300) {
		    resolve(JSON.parse(xhr.response));
		} else {
		    reject({
			status: this.status,
			statusText: xhr.statusText
		    });
		}
	    };
	    xhr.onerror = function () {
		reject({
		    status: this.status,
		    statusText: xhr.statusText
		});
	    };
	    xhr.send();
	});
    }
    
    return Object.freeze({
	fetch: fetch
    });
}
