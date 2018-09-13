function makeSocialNetwork(makeXHR) {
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
			message: xhr.statusText
		    });
		}
	    };
	    xhr.onerror = function () {
		reject({
		    status: this.status,
		    message: xhr.statusText
		});
	    };
	    xhr.send();
	});
    }


    function draw(net, rating, container) {
	// colors get darker like karate belts
	const colors = [
	    '#f0f0f0', // "white belt"
	    'khaki', // apprentice
	    'orange', // journeyer
	    'darkgray' // master
	];

	// create an array with nodes
        const ratingByLogin = new Map(net.nodes.map(n => [n.login, n.rating]));
        const [_rating, who, why] = net.flow[rating - 1];
	const nodes = new vis.DataSet(
	    who.map(
  	        n => ({
                    id: n.login,
		    color: {
			background: colors[ratingByLogin.get(n.login)] || '#f0f0f0',
			border: 'black'
		    },
		    label: n.login,
	        })
	    ));

        // create an array with edges
	const edges = new vis.DataSet(
	    why.map(
	        e => ({
                    'from': e.voter,
                    'to': e.subject,
                    label: e.flow.toString(),
		    arrows: 'to',
		    color: {color: colors[rating]},
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
