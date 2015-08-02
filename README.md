
# poedex

poedex is an inventory management and market tool for Path of Exile. It load your
stash via the `pathofexile.com` website and looks up prices on `poe.trade`. Similar
to acquisition and procurement it will also update your shop forum thread and
mark you as online.

*Note: This program isn't associated with GGG or poe.trade. It simply talks to
those websites to get data.*

## Installation

You can download a release from https://github.com/poetools/poedex/releases,
extract it, and run it from wherever you wish. Releases are provided for Windows
and Linux, hopefully someone can package up a Mac release soon.

If you want to run `poedex` on a platform we didn't bundle a release for or try
a development version, use a copy of `nw` for your platform and run the directory
containing the `package.json` file.

## Updating

Instead of downloading the entire release again (20MB+) you can just download the
most recent code from Github here in a .zip file. Just extract the file over the
previous release you downloaded. This updates all the HTML and Javascript used to
run the program, while keeping the same version of node-webkit (essentially a
a web browser)

## FAQ

### Is this program safe to use?

Yes. The `pathofexile.com` website is read-only and cannot accidentally remove or
automatically trade any items. This program does not read from process memory or
do anything that would warrent getting someone banned. It does the same thing as
acquisition and procurement.

You should always be wary of logging in or entering your password to untrusted
programs. We provide full source code that you and others can verify is not
doing anything tricky. Paranoid users can download `nw.js` themselves to verify
we have not modified the `.exe` or any other files.

### Where is it pulling price data from?

It talks to `poe.trade` and queries it for similar items. There is a lot of work
to be done to properly determine what similar items are and adjust prices
accordingly.

### Why not make a browser plugin?

Because many people are using different browsers and it's a pain to work around
cross-domain restrictions. Using `nw.js` lets us get all the benefits of a browser
without the (rather silly) access restrictions.

### How do I mark items to sell?

Work is still being done on these features.

## Forking

Fork and download the repository on Github. Move a copy of nw.js (node-webkit)
into a directory called `nw` and you can use `run.bat` or `run.sh` to run the
program as a developer. It should look something like this:

    nw/
	    nw.exe
		libEGL.dll
    index.html
	package.json
	run.bat
