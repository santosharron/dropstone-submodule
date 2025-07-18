import { JSONContent } from "@tiptap/react";
import {
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  MessagePart,
  RangeInFile,
} from "core";
import { stripImages } from "core/llm/images";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { setDirectoryItems } from "../../redux/slices/stateSlice";
import { RootState, store } from "../../redux/store";

interface MentionAttrs {
  label: string;
  id: string;
  itemType?: string;
  query?: string;
}

function formatMemoriesAsContext(memories: { content: string }[]): ContextItemWithId | null {
  if (memories.length === 0) return null;

  return {
    id: {
      itemId: "memories",
      providerTitle: "memories"
    },
    name: "Dropstone Memories",
    description: "User memories and context",
    content: "<Beginning of relevant user context separated by comma, refer these only if required>\n" +
            memories.map(m => m.content).join(", ") + "\n" +
            "<End of relevant user context>"
  };
}

/**
 * This function converts the input from the editor to a string, resolving any context items
 * Context items are appended to the top of the prompt and then referenced within the input
 * @param editor
 * @returns string representation of the input
 */

async function resolveEditorContent(
  editorState: JSONContent,
  modifiers: InputModifiers,
  ideMessenger: IIdeMessenger,
): Promise<[ContextItemWithId[], RangeInFile[], MessageContent]> {
  let parts: MessagePart[] = [];
  let contextItemAttrs: MentionAttrs[] = [];
  const selectedCode: RangeInFile[] = [];
  let slashCommand = undefined;
  for (const p of editorState?.content) {
    if (p.type === "paragraph") {
      const [text, ctxItems, foundSlashCommand] = resolveParagraph(p);

      // Only take the first slash command

      if (foundSlashCommand && typeof slashCommand === "undefined") {
        slashCommand = foundSlashCommand;
      }

      contextItemAttrs.push(...ctxItems);

      if (text === "") {
        continue;
      }

      if (parts[parts.length - 1]?.type === "text") {
        parts[parts.length - 1].text += "\n" + text;
      } else {
        parts.push({ type: "text", text });
      }
    } else if (p.type === "codeBlock") {
      if (!p.attrs.item.editing) {
        const text =
          "```" +
          p.attrs.item.description +
          "\n" +
          p.attrs.item.content +
          "\n```";
        if (parts[parts.length - 1]?.type === "text") {
          parts[parts.length - 1].text += "\n" + text;
        } else {
          parts.push({
            type: "text",
            text,
          });
        }
      }

      const name: string = p.attrs.item.name;
      let lines = name.substring(name.lastIndexOf("(") + 1);
      lines = lines.substring(0, lines.lastIndexOf(")"));
      const [start, end] = lines.split("-");

      selectedCode.push({
        filepath: p.attrs.item.description,
        range: {
          start: { line: parseInt(start) - 1, character: 0 },
          end: { line: parseInt(end) - 1, character: 0 },
        },
      });
    } else if (p.type === "image") {
      parts.push({
        type: "imageUrl",
        imageUrl: {
          url: p.attrs.src,
        },
      });
    } else {
      console.warn("Unexpected content type", p.type);
    }
  }

  let contextItemsText = "";
  let contextItems: ContextItemWithId[] = [];

  const state = store.getState() as any;
  const history = state.state?.history || [];
  const memories = state.state?.memories || [];

  // following is the condition to check for very first msg in chat
  // Verifies that no messages have content yet, meaning this is truly the first message being composed
  const isFirstMessage = history.length <= 2 && history.every(item => !item?.message?.content);
  if (isFirstMessage && memories.length > 0) {
    const memoriesContext = formatMemoriesAsContext(memories);
    if (memoriesContext) {
      contextItems.push(memoriesContext);
      contextItemsText += memoriesContext.content + "\n\n";
    }
  }

  for (const item of contextItemAttrs) {
    const data = {
      name: item.itemType === "contextProvider" ? item.id : item.itemType,
      query: item.query,
      fullInput: stripImages(parts),
      selectedCode,
    };
    const resolvedItems = await ideMessenger.request(
      "context/getContextItems",
      data,
    );
    contextItems.push(...resolvedItems);
    for (const resolvedItem of resolvedItems) {
      contextItemsText += resolvedItem.content + "\n\n";
    }
  }

  // Depreciated DirStructure on every request (-nang)
  // const defaultModelTitle = (store.getState() as any).state.defaultModelTitle;
  // const excludeDirStructure =
  //   defaultModelTitle?.toLowerCase() &&
  //   EXCLUDE_DIR_STRUCTURE.some((term) =>
  //     defaultModelTitle.toLowerCase().includes(term),
  //   );

  // if (!excludeDirStructure) {
  //   const previousDirectoryItems = (store.getState() as any).state
  //     .directoryItems;
  //   // use directory structure
  //   const directoryItems = await ideMessenger.request(
  //     "context/getContextItems",
  //     {
  //       name: "directory",
  //       query: "",
  //       fullInput: stripImages(parts),
  //       selectedCode,
  //     },
  //   );

  //   if (previousDirectoryItems !== directoryItems[0].content) {
  //     store.dispatch(setDirectoryItems(directoryItems[0].content));
  //     contextItems.push(...directoryItems);
  //     for (const codebaseItem of directoryItems) {
  //       contextItemsText += codebaseItem.content + "\n\n";
  //     }
  //   }
  // }

  // cmd+enter to use codebase
  if (modifiers.useCodebase) {
    const codebaseItems = await ideMessenger.request(
      "context/getContextItems",
      {
        name: "codebase",
        query: "",
        fullInput: stripImages(parts),
        selectedCode,
      },
    );
    contextItems.push(...codebaseItems);
    for (const codebaseItem of codebaseItems) {
      contextItemsText += codebaseItem.content + "\n\n";
    }
  }

  if (contextItemsText !== "") {
    contextItemsText += "\n";
  }

  if (slashCommand) {
    let lastTextIndex = findLastIndex(parts, (part) => part.type === "text");
    const lastPart = `${slashCommand} ${parts[lastTextIndex]?.text || ""}`;
    if (parts.length > 0) {
      parts[lastTextIndex].text = lastPart;
    } else {
      parts = [{ type: "text", text: lastPart }];
    }
  }

  return [contextItems, selectedCode, parts];
}

function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean,
): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return i;
    }
  }
  return -1; // if no element satisfies the predicate
}

function resolveParagraph(p: JSONContent): [string, MentionAttrs[], string] {
  const defaultModelTitle = (store.getState() as any).state.defaultModelTitle;
  let text = "";
  const contextItems = [];
  let slashCommand = undefined;
  for (const child of p.content || []) {
    if (child.type === "text") {
      text += text === "" ? child.text.trimStart() : child.text;
    } else if (child.type === "mention") {
      text +=
        typeof child.attrs.renderInlineAs === "string"
          ? child.attrs.renderInlineAs
          : child.attrs.label;
      contextItems.push(child.attrs);
    } else if (child.type === "slashcommand") {
      if (typeof slashCommand === "undefined") {
        slashCommand = child.attrs.id;
      } else {
        text += child.attrs.label;
      }
    } else {
      console.warn("Unexpected child type", child.type);
    }
  }
  return [text, contextItems, slashCommand];
}

export default resolveEditorContent;
