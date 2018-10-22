/* global Bacon */

function sessionUI(session, clock, $) {
    const ui = {
	user: $('#user'),
	session: $('#session'),
	results: $('#results'),
    };

    const textStream = jq => jq
          .asEventStream('keydown')
          .debounce(300)
          .map(event => event.target.value)
          .skipDuplicates();
    const memberKey = textStream($('#memberPublicKey'))

    const sessionInfo = Bacon.fromPromise(session.post('info'));
    sessionInfo.onValue(si => {
	const user = si.userProfile,
	      dob_str = user.detail.created_at,
	      dob = dob_str ? new Date(dob_str) : null,
	      since = dob ? ` since ${dob.getFullYear()}-${dob.getMonth() + 1}` : null,
	      accountDetail = user.username + since;
	ui.user.text(user.displayName)
	    .attr('title', accountDetail)
	    .attr('href', user.url);

	ui.session.text(`login: ${ new Date(si.created).toISOString() }`);

        $('#certKey').text(si.gameKey);
        $('#guild').text(user.detail.guild.name);
        $('#guild').attr('title', user.detail.guild.id);
        $('#memberRole').text(user.detail.role0.name);
        $('#memberRole').attr('title', user.detail.role0.id);
        $('#joined_at').val(fmtTime(user.detail.created_at));

        memberKey.onValue((k) => {
            console.log('key:', k);
            const binding = {
                publicKey: k,
                discord: {
                    id: user.id,
                    userName: user.displayName,
                    role: user.detail.role0.id,
                    guild: user.detail.guild.id,
                },
            };
            $('#certBinding').prop('readonly', false);
            $('#certBinding').val(JSON.stringify(binding, null, 2));
            $('#certBinding').prop('readonly', true);
        });

    });

    const memberSig = textStream($('#memberSig'));
    memberSig.onValue(_ => { $('#memberSigTime').val(fmtTime(clock().toISOString())); });

    const requestCert = $('#requestCert').asEventStream('click').log('requestCert click');
    const requestInfo = requestCert
	  .map(_e => ({
              // ISSUE: JSON.parse can fail
              binding: JSON.parse($('#certBinding').val()),
              memberSignature: $('#memberSig').val(),
              memberSigTime: $('#memberSigTime').val()
	  })).log('request');
    const requestSend = requestInfo
	  .flatMap(info => Bacon.fromPromise(session.post('requestCertificate', info)))
          .log('request sent');
    // ISSUE: TODO: handle reply...

    function fmtTime(iso) {
        return iso.substring(0, "yyyy-MM-ddThh:mm".length);
    }

    const eachReply = requestSend.merge(requestSend.mapError(err => null)).log('reply');
    requestSend.awaiting(eachReply).log('awaiting...')
	.onValue(loading => {
	    $('#requestCert').attr('disabled', loading);

	    if (loading) {
	        ui.results.hide();
	        $('#status').hide();
	    }
        });

    eachReply.onError((msg) => {
	$('#status').text(msg);
	$('#status').show();
    });

    eachReply.onValue(r => {
        $('#verifiedCredential').text(r.replace(/\|/g, '|\n'));
        ui.results.show();
    });
}


// dead code?
function trustCertUI() {
    const ui = {
	user: $('#user'),
	session: $('#session'),
	cert_time: $('#cert_time'),
	subject: $('#subject'),
	rating: $('#rating'),
	certify: $('#certify'),
	results: $('#results'),
	recordKey: $('#recordKey'),
	takeTurnTerm: $('#takeTurnTerm'),
	turnSig: $('#turnSig'),
    };

    showCertTime(clock());
    function showCertTime(t) {
	ui.cert_time.val(fmtTime(t.toISOString()));
    }

    Bacon.fromPromise(session.post('select', 'users')).onValue(peers => {
	ui.subject.html('');
	peers.forEach(who => ui.subject.append(
	    $('<option>', { value: who.username,
			    html: `${who.username}: ${who.displayName}`
			  })));
    });

    // issue: session.merge(...) => session.post('merge', ...)
    const certifyStart = ui.certify.asEventStream('click').log('certify click');
    const certifyRecord = certifyStart
	      .zip(sessionInfo)
	      .map(([_e, si]) => ({
		  voter: si.userProfile.username,
		  subject: ui.subject.val(),
		  rating: ui.rating.val(),
		  cert_time: clock()
	      })).log('record');
    certifyRecord.onValue(record => {
	showCertTime(record.cert_time);
    });
    const certifySend = certifyRecord
	      .flatMap(record => Bacon.fromPromise(session.post('merge', 'trust_cert', record)));
    const certifyReply = certifySend.merge(certifySend.mapError(err => null)).log('reply');
    certifyStart.awaiting(certifyReply).log('awaiting@@')
	.onValue(loading => {
	ui.certify.attr('disabled', loading);

	if (loading) {
	    ui.results.hide();
	}
    });

    // ISSUE: certifyReply.onError(err => ...)
    certifyReply.onValue(r => {
	ui.recordKey.val(JSON.stringify(r.recordKey));
	ui.takeTurnTerm.val(r.takeTurnTerm);
	ui.turnSig.val(r.turnSig);
	ui.results.show();
    });
}


const def = obj => Object.freeze(obj);

function mockSession({ clock }) {
    const db = {
	// ISSUE: dbr_tables.sql calls it github_users, with login
	users: {
	    key: ['username'],
	    // JSON-stringified key cols -> record
	    records: {
		'["a1"]': { username: 'a1', displayName: 'Angela' },
		'["b2"]': { username: 'b2', displayName: 'Bob' },
		'["c3"]': { username: 'c3', displayName: 'Charlie' },
		'["d4"]': { username: 'd4', displayName: 'Darlene' },
	    }
	},
	trust_cert: {
	    key: ['voter', 'subject'],
	    records: {}
	}
    };

    return def({ info, select, merge });

    function info() {
	const min = 1000 * 60;
	return Promise.resolve({
	    created: new Date(clock().valueOf() - 15 * min),
	    userProfile: {
		username: "dckc", displayName: "Dan Connolly",
		url: 'https://github.com/dckc',
		detail: {
		    createdAt: new Date(2009, 9, 1)
		}
	    }
	});
    }

    function select(tablename) {
	const table = db[tablename];
	if (!table) {
	    return Promise.reject('unknown table: ' + tablename);
	}

	return Promise.resolve(Object.values(table.records));
    }

    function merge(tablename, record) {
	const table = db[tablename];
	if (!table) {
	    return Promise.reject('unknown table: ' + tablename);
	}
	const key = table.key.map(field => record[field]);
	table.records[JSON.stringify(key)] = record;
	return Promise.resolve(key);
    }
}
