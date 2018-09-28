// import Bacon from 'baconjs';

function gameUI(gameBoard, $) {
    console.log(gameBoard);
    const ui = {
	path: $('#path'),
	callbackPath: $('#callbackPath'),
	provider: $('#provider'),
	locus: $('#locus'),
	role: $('#role'),
	token: $('#token'),
	id: $('#clientID'),
	secret: $('#clientSecret'),
	makeSignIn: $('#makeSignIn')
    };

    Bacon.fromPromise(gameBoard.post('label'))
	.onValue(label => {
	    $('title').text(label + 'on RChain');
	    $('h1').text(label);
	});

    ui.makeSignIn.asEventStream('click').log('click')
	.map(_ => ({
	    path: ui.path.val(),
	    callbackPath: ui.callbackPath.val(),
	    provider: ui.provider.val(),
	    locus: ui.locus.val(),
	    role: ui.role.val(),
	    token: ui.token.val(),
	    id: ui.id.val(),
	    secret: ui.secret.val()
	})).log('fields')
	.flatMap(fields => Bacon.fromPromise(gameBoard.post(
	    'makeSignIn',
  	    fields.path, fields.callbackPath,
            fields.provider, fields.locus, fields.role, fields.token,
            fields.id, fields.secret))
		 .log('makeClient')
		 .zip(Bacon.once(fields), (c, f) => [c, f])).log('@@flatMap |> zip')
	.onValue(addClient);

    function addClient([it, {path, provider, id}]) {
        $('#clients').append(
            $('<a />',
              {href: it.webkey,
               text: `${path}: ${provider}: ${id}`})
                .wrap('<li />').parent());
    }
}
