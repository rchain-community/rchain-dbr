See https://github.com/rchain/Members/issues/260

## Instructions
  - Install xataface
  - use composer to install all dependencies
  - copy conf.ini.example to conf.ini and replace params with correct values.
  - copy xataface_template/modules to your xataface installation/modules folder
  - create github app, discord app, and discord bot. Use keys and tokens provided to populate conf.ini. Dont forget to add in the callback URLs
  
  
## TODO

  - voter_gh: don't let user choose; use their login credentials
  - you can only edit your own votes
    - new votes obsolete old votes?
    - ah: [history logging](http://xataface.com/documentation/how-to/history-howto)
  - reporting epoch: 201712 vs 201801
  - import persons, issues from github repo
    - sync/update
    - bootstrap: [import filters](http://xataface.com/documentation/how-to/import_filters)
    - The Right Way: use graphql
  - money datatype: is integer dollars good enough?
  - [dashboard](http://xataface.com/wiki/Creating_a_Dashboard)

**PHP is horrible. Is there something equivalent to xataface for
node.js? Or at least python?**
