function makeSocialNetwork(makeXHR, container) {
    function fetch() {
	return new Promise(function (resolve, reject) {
	    const xhr = makeXHR();
	    xhr.open("GET", "/aux/trust_net");
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
	const colors = [
	    '#f0f0f0', // "white belt"
	    'khaki', // apprentice
	    'orange', // journeyer
	    'grey' // master
	];

	// create an array with nodes
	const nodes = new vis.DataSet(
	    net.nodes.map(
		n => Object.assign(n, {
		    color: {
			background: colors[n.rating] || '#f0f0f0',
			border: 'black'
		    },
		    label: n.sig,
		})
	    ));

	// create an array with edges
	const edges = new vis.DataSet(
	    net.edges.map(
		e => Object.assign(e, {
		    arrows: 'to',
		    color: {color: colors[e.rating]},
		})
	    ));

	var data = {
	    nodes: nodes,
	    edges: edges
	};
	var options = {
	    interaction: {
		navigationButtons: true,
		keyboard: true
	    }
	};
	var network = new vis.Network(container, data, options);
    }

    return Object.freeze({
	fetch: fetch,
	draw: draw
    });
}
