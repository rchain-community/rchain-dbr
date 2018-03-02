"""social_coding_sync -- sync users, issues, endorsements from github

..

Usage:
  social_coding_sync [options] reactions

Options:
  --repo-rd=FILE  JSON file with repository read-access token
                  [default: creds/ram-dbr-access-token.json]
  --cache=DIR     directory for query results [default: cache]
"""

from urllib.request import Request
import json
import logging

from docopt import docopt
import pkg_resources as pkg

log = logging.getLogger(__name__)


def main(argv, cwd, build_opener):
    log.debug('argv: %s', argv)
    opt = docopt(__doc__.split('..\n', 1)[1], argv=argv[1:])
    log.debug('opt: %s', opt)

    with (cwd / opt['--repo-rd']).open() as cred_fp:
        repoRd = json.load(cred_fp)['token']
    qs = QuerySvc(build_opener(), repoRd)
    login = qs.runQ('query { viewer { login }}')
    log.info(login)

    reactions = qs.runQ(Reactions.query)
    out = cwd / opt['--cache'] / 'reactions.json'
    with out.open('w') as data_fp:
        json.dump(reactions, data_fp)
    log.info('%d reactions saved to %s',
             len(reactions['repository']['issues']['nodes']), out)


class QuerySvc(object):
    endpoint = 'https://api.github.com/graphql'

    def __init__(self, urlopener, token):
        self.__urlopener = urlopener
        self.__token = token

    def runQ(self, query, variables={}):
        req = Request(
            self.endpoint,
            data=json.dumps({'query': query,
                             'variables': variables}).encode('utf-8'),
            headers={
                "Authorization": "bearer " + self.__token
            })
        log.info("query -> %s", self.endpoint)
        response = self.__urlopener.open(req)
        if response.getcode() != 200:
            raise response
        body = json.loads(response.read().decode('utf-8'))
        if body.get('errors'):
            raise IOError(body['errors'])
        return body['data']


class Reactions(object):
    query = pkg.resource_string(__name__, 'reactions.graphql').decode('utf-8')


if __name__ == '__main__':
    def _script():
        from sys import argv
        from urllib.request import build_opener
        from pathlib import Path

        logging.basicConfig(level=logging.INFO)
        main(argv, cwd=Path('.'), build_opener=build_opener)
    _script()
