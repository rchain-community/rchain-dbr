<?php
// Include the Xataface API
require_once 'xataface/dataface-public-api.php';

// Initialize Xataface framework
df_init(__FILE__, 'xataface')->display();
    // first parameter is always the same (path to the current script)
    // 2nd parameter is relative URL to xataface directory (used for CSS files and javascripts)
