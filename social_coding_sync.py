"""social_coding_sync -- sync users, issues, endorsements from github

..

Usage:
  social_coding_sync [options] reactions_get
  social_coding_sync [options] reactions_norm

Options:
  --repo-rd=FILE  JSON file with repository read-access token
                  [default: creds/ram-dbr-access-token.json]
  --cache=DIR     directory for query results [default: cache]
"""

from urllib.request import Request
import json
import logging

from docopt import docopt
import pandas as pd
import pkg_resources as pkg

log = logging.getLogger(__name__)


def main(argv, cwd, build_opener):
    log.debug('argv: %s', argv)
    opt = docopt(__doc__.split('..\n', 1)[1], argv=argv[1:])
    log.debug('opt: %s', opt)

    cache = cwd / opt['--cache']
    if opt['reactions_get']:
        reactions_get(cwd / opt['--repo-rd'], build_opener(),
                      cache / 'reactions.json')
    elif opt['reactions_norm']:
        voter = 'dckc'  # @@KLUDGE
        with (cache / 'reactions.json').open('r') as fp:
            reaction_info = json.load(fp)
        reactions = Reactions.as_df(reaction_info)
        with (cache / 'reactions.pkl').open('wb') as pkl:
            reactions.to_pickle(pkl)
        log.info('%d rows in saved df', len(reactions))
        log.info('reactions by %s:\n%s', voter,
                 reactions[reactions.index.get_level_values(0) == voter])


def reactions_get(cred_path, web_ua, dest):
    with cred_path.open() as cred_fp:
        repoRd = json.load(cred_fp)['token']
    qs = QuerySvc(web_ua, repoRd)
    login = qs.runQ('query { viewer { login }}')
    log.info(login)

    reaction_info = qs.runQ(Reactions.query)
    with dest.open('w') as data_fp:
        json.dump(reaction_info, data_fp)
    log.info('%d reactions saved to %s',
             len(reaction_info['repository']['issues']['nodes']), dest)


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

    endorsements = ['HEART', 'HOORAY', 'LAUGH', 'THUMBS_UP']

    @classmethod
    def as_df(cls, reactions):
        return pd.DataFrame([
            dict(issue_num=issue['number'],
                 # title=issue['title'],
                 worker=comment['author']['login'],
                 createdAt=comment['createdAt'],
                 # content=reaction['content'],
                 voter=reaction['user']['login'],
            )
            for issue in reactions['repository']['issues']['nodes']
            for comment in issue['comments']['nodes']
            for reaction in comment['reactions']['nodes']
            if reaction['content'] in cls.endorsements
        ]).set_index(['voter', 'issue_num', 'worker']).sort_index()


if __name__ == '__main__':
    def _script():
        from sys import argv
        from urllib.request import build_opener
        from pathlib import Path

        logging.basicConfig(level=logging.INFO)
        main(argv, cwd=Path('.'), build_opener=build_opener)
    _script()
