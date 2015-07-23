Quick-Start Guide
=================

## Windows 7 x64
 
### Install basic requirements
*Install Node.js
*Install npm
*Install git, make sure directory with executable is included in system PATH environment variable
*Install cygwin or MSYS2 environment to have gnu make available
  *in cygwin, select the make package from within setup-x86_64.exe, in MSYS2 use "pacman -S make" to install
*Install some flavor of MS visual Studio
*if running java tests, make sure current Java Development Kit is installed with the bin directory in system PATH environment variable (need to be able to run keytool)
 
### Installing blpapi-http
*clone repository
*if version of MSVS isn't what's expected, npm installs that require compiling dependencies will fail; use npm config to set the version, e.g. “npm config set msvs_version 2015” for visual studio 2015
*from within a cygwin or MSYS2 shell, run "make build" to build the wrapper and dependencies
 
### Run notes
*edit config.js to set options
  *while code defaults to use http rather than https for the server, most code examples are set up to use https
  *without root privileges, default port of 80 for server will fail to bind. May wish to specify higher port for testing, e.g. 4567
*launch by running "node index.js"
*If running examples with server launched in http mode, simply find/replace "https" to "http" in the example code, explicitly specify port and host, comment out “key:”, ”cert:”, and “ca:” lines in “var options = {…}”
