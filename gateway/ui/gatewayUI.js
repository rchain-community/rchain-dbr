// import Bacon from 'baconjs';

function gatewayUI(gateway, $) {
    console.log(gateway);
    const labelElt = $('#label');
    const idElt = $('#client_id');
    const secretElt = $('#client_secret');
    $('#makeClient').asEventStream('click').log('click')
	.map(_ => ({ label: labelElt.val(), id: idElt.val(), secret: secretElt.val() })).log('fields')
	.flatMap(fields => Bacon.fromPromise(gateway.post('makeClient', fields, fields.label))
		 .log('makeClient')
		 .zip(Bacon.once(fields), (c, f) => [c, f])).log('flatMap |> zip')
	.onValue(addClient);

    function addClient([it, {label, id}]) {
        $('#clients').append(
            $('<a />',
              {href: it.webkey,
               text: `${label}: ${id}`})
                .wrap('<li />').parent());
    }
}
