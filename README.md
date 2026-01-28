# Frank!Framework
The Frank!Framework extension is meant to support developers when working with the Frank!Framework.

## Features
* Open or create a new Frank. On the left of your window in the activity bar the Frank!Framework extension has its own view container, containing options to open or create a new Frank. When creating a new Frank, you will have to choose between a few options. Only the 'Simple Frank' option will generate a project structure in your workspace , the other options will forward you to the appropriate documentation.
* Run a Frank. You can find the Frank!Start view in the explorer. When having a file of a specific Frank open in your editor, you will be able to run this Frank in the Frank!Start view. You can choose to run it with Ant, Docker or Docker Compose. If a build.xml/Dockerfile/compose file is not present in the Frank you're trying to run, you will be prompted to automatically add one.
* Manage FF! version when running a Frank with Ant. You can manage what version of the FF! a Frank uses in the Frank!Start view. The current version of a Frank will be displayed besides its name, right click on the Frank to display the options. You can choose between the latest version, the latest stable version or a version already locally installed.
* Configuration flowchart. The secondary sidebar with the Flowchart view container opens automatically and displays the flowchart of the configuration open in your editor. It updates on every save or document change.
* Frank!Framework Wiki snippets. Examples on the Frank!Framework Wiki get loaded in as global user snippets. They are organized per component name. Just type the name of the component you want to insert, and choose from the list or hit enter.
* User snippets. You can also make your own snippets by selecting text, right clicking and clicking on 'Add Frank! Snippet'. You will be asked to give the snippet a name. You can group snippets together by giving it the same name as an already existing one.
* View snippets. You can finds the Frank!Snippets view in the explorer. It displays a tree of both Frank!Framework Wiki snippets and user snippets. Click a snippet in this list to insert it into your editor.
* Manage user snippets. Also in the Frank!Snippets view you can manage your user snippets. Click on a group name to open the management window. At the top you will see the name, below that a form to add a new snippet to this group and below that all the snippets in the group. Here you can edit or remove existing snippets or add new ones. You can also choose to contribute to the Frank!Framework Wiki. Which just opens the (maybe already existing) Wiki file of this specific snippet group. Which will be committed and pushed its save.
* Documentation. When working on a config, components which have a page in the Frank!Doc will be underlined. Ctrl click them to be forwarded to their page, for easy access to the documentation.

## Installation
Install the extension using VS Code's Extension Marketplace.

## Contributing
This project welcomes contributions and suggestions. Take a look at the vsc-extension-quickstart.md file to get started.