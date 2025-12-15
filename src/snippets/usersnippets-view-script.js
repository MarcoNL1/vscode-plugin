const vscode = acquireVsCodeApi();

const container = document.getElementById("snippetsContainer");

function addSnippetCard(snippet, snippetIndex) {
    let editing = false;

    const snippetCard = document.createElement("div");
    snippetCard.className = "snippetCard";

    const footer = document.createElement("div");
    footer.className = "footerRow";

    const iconsContainer = document.createElement("div");
    iconsContainer.className = "iconsContainer";

    const editIcon = document.createElement("i");
    editIcon.className = "codicon codicon-edit";
    const deleteIcon = document.createElement("i");
    deleteIcon.className = "codicon codicon-trash";
    const uploadIcon = document.createElement("i");
    uploadIcon.className = "codicon codicon-export";

    iconsContainer.appendChild(editIcon);
    iconsContainer.appendChild(deleteIcon);
    iconsContainer.appendChild(uploadIcon);

    footer.appendChild(iconsContainer);

    const details = document.createElement("div");
    details.className = "details";

    const snippetPrefixContainer = document.createElement("div");
    snippetPrefixContainer.className = "snippetPrefixContainer";
    const snippetPrefixLabel = document.createElement("label");
    snippetPrefixLabel.innerText = "Prefix"
    const snippetPrefix = document.createElement("textarea");
    snippetPrefix.className = "snippetPrefix";
    snippetPrefix.readOnly = !editing;

    snippetPrefixContainer.appendChild(snippetPrefixLabel);
    snippetPrefixContainer.appendChild(snippetPrefix);

    const snippetDescriptionContainer = document.createElement("div");
    snippetDescriptionContainer.className = "snippetDescriptionContainer";
    const snippetDescriptionLabel = document.createElement("label");
    snippetDescriptionLabel.innerText = "Description"
    const snippetDescription = document.createElement("textarea");
    snippetDescription.className = "snippetDescription";
    snippetDescription.readOnly = !editing;

    snippetDescriptionContainer.appendChild(snippetDescriptionLabel);
    snippetDescriptionContainer.appendChild(snippetDescription);

    details.appendChild(snippetPrefixContainer);
    details.appendChild(snippetDescriptionContainer);

    const body = document.createElement("div");
    body.className = "body";

    const snippetBodyContainer = document.createElement("div");
    snippetBodyContainer.className = "snippetBodyContainer";
    const snippetBodyLabel = document.createElement("label");
    snippetBodyLabel.innerText = "Body"
    const snippetBody = document.createElement("textarea");
    snippetBody.readOnly = !editing;
    snippetBody.className = "snippetBody";

    snippetBodyContainer.appendChild(snippetBodyLabel);
    snippetBodyContainer.appendChild(snippetBody);

    body.appendChild(snippetBodyContainer);

    snippetPrefix.value = snippet.prefix;
    snippetDescription.value = snippet.description;
    snippetBody.value = snippet.body;

    snippetCard.appendChild(details);
    snippetCard.appendChild(body);
    snippetCard.appendChild(footer);

    snippetPrefix.addEventListener("focus", (e) => {
        if (snippetPrefix.readOnly) e.target.blur();
    });
    snippetDescription.addEventListener("focus", (e) => {
        if (snippetDescription.readOnly) e.target.blur();
    });
    snippetBody.addEventListener("focus", (e) => {
        if (snippetBody.readOnly) e.target.blur();
    });

    editIcon.addEventListener("click", () => {
        editing = !editing;

        snippetPrefix.readOnly = !editing;
        snippetDescription.readOnly = !editing;
        snippetBody.readOnly = !editing;

        editIcon.className = editing ? "codicon codicon-save" : "codicon codicon-edit";

        if (!editing) {
            const snippet = {
                prefix: snippetPrefix.value,
                body: snippetBody.value,
                description: snippetDescription.value
            }

            safeUserSnippets[snippetIndex] = snippet;
            vscode.postMessage({
                command: "editSnippet",
                snippetIndex: snippetIndex,
                snippet: snippet
            });
        }
    });

    deleteIcon.addEventListener("click", () => {
        snippetCard.remove();

        vscode.postMessage({
            command: "deleteSnippet",
            snippetIndex: snippetIndex
        });
    });

    uploadIcon.addEventListener("click", () => {
        vscode.postMessage({
            command: "uploadSnippet",
            snippetIndex: snippetIndex
        });
    });

    return snippetCard;
}

const snippetName = document.createElement("h1");
snippetName.className = "snippetName";
snippetName.innerText = name;

const snippetsPerNameContainer = document.createElement("div");
snippetsPerNameContainer.className = "snippetsPerNameContainer";

container.appendChild(snippetName);

const newSnippetCard = document.createElement("div");
newSnippetCard.className = "snippetCard";

const details = document.createElement("div");
details.className = "details";

const footer = document.createElement("div");
footer.className = "footerRow";

const iconsContainer = document.createElement("div");
iconsContainer.className = "iconsContainer";

const addIcon = document.createElement("i");
addIcon.className = "codicon codicon-add";

iconsContainer.appendChild(addIcon);

footer.appendChild(iconsContainer);

const snippetPrefixContainer = document.createElement("div");
snippetPrefixContainer.className = "snippetPrefixContainer";
const snippetPrefixLabel = document.createElement("label");
snippetPrefixLabel.innerText = "Prefix"
const snippetPrefix = document.createElement("textarea");
snippetPrefix.className = "snippetPrefix";

snippetPrefixContainer.appendChild(snippetPrefixLabel);
snippetPrefixContainer.appendChild(snippetPrefix);

const snippetDescriptionContainer = document.createElement("div");
snippetDescriptionContainer.className = "snippetDescriptionContainer";
const snippetDescriptionLabel = document.createElement("label");
snippetDescriptionLabel.innerText = "Description"
const snippetDescription = document.createElement("textarea");
snippetDescription.className = "snippetDescription";

snippetDescriptionContainer.appendChild(snippetDescriptionLabel);
snippetDescriptionContainer.appendChild(snippetDescription);

details.appendChild(snippetPrefixContainer);
details.appendChild(snippetDescriptionContainer);

const body = document.createElement("div");
body.className = "body";

const snippetBodyContainer = document.createElement("div");
snippetBodyContainer.className = "snippetBodyContainer";
const snippetBodyLabel = document.createElement("label");
snippetBodyLabel.innerText = "Body"
const snippetBody = document.createElement("textarea");
snippetBody.className = "snippetBody";

snippetBodyContainer.appendChild(snippetBodyLabel);
snippetBodyContainer.appendChild(snippetBody);

body.appendChild(snippetBodyContainer);

newSnippetCard.appendChild(details);
newSnippetCard.appendChild(body);
newSnippetCard.appendChild(footer);

addIcon.addEventListener("click", () => {
    const snippet = {
        prefix: snippetPrefix.value,
        body: snippetBody.value,
        description: snippetDescription.value
    }

    snippetPrefix.value = "";
    snippetBody.value = "";
    snippetDescription.value = "";

    snippetsPerNameContainer.appendChild(addSnippetCard(snippet, 10));

    vscode.postMessage({
        command: "addSnippet",
        snippet: snippet
    });
});

container.appendChild(newSnippetCard);

safeUserSnippets.forEach((snippet, snippetIndex) => {
    let snippetCard = addSnippetCard(snippet, snippetIndex);

    snippetsPerNameContainer.appendChild(snippetCard);
});

container.appendChild(snippetsPerNameContainer);
