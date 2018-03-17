function makeSocialNetwork(makeXHR, container) {
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


    function draw(net) {
	// colors get darker like karate belts
	const colors = {
	    '0': 'white',
	    apprentice: 'green',
	    journeyer: 'orange',
	    master: 'black'
	};

	// create an array with nodes
	const nodes = new vis.DataSet(
	    net.nodes.map(
		n => Object.assign(n, {color: colors[n.rating_label]})));

	// create an array with edges
	const edges = new vis.DataSet(net.edges);

	var data = {
	    nodes: nodes,
	    edges: edges
	};
	var options = {};
	var network = new vis.Network(container, data, options);
    }

    return Object.freeze({
	fetch: fetch,
	draw: draw
    });
}
