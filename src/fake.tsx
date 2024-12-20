import { Action, ActionPanel, Clipboard, Color, Icon, List } from "@raycast/api";
import { showFailureToast, useCachedState, usePromise } from "@raycast/utils";
import { useRef } from "react";

import { faker, Randomizer } from "@faker-js/faker";
import { RandomGenerator, xoroshiro128plus } from "pure-rand";
import { invoke } from "es-toolkit/compat";
import * as cheerio from "cheerio";

// const cache = new Cache();

function generatePureRandRandomizer(
  seed: number | number[] = Date.now() ^ (Math.random() * 0x100000000),
  factory: (seed: number) => RandomGenerator = xoroshiro128plus,
): Randomizer {
  const self = {
    next: () => (self.generator.unsafeNext() >>> 0) / 0x100000000,
    seed: (seed: number | number[]) => {
      self.generator = factory(typeof seed === "number" ? seed : seed[0]);
    },
  } as Randomizer & { generator: RandomGenerator };
  self.seed(seed);
  return self;
}

function runCommand(categoryName: string, methodName: string = "") {
  if (categoryName.includes("randomizer")) {
    // const randomizer = generatePureRandRandomizer();
    return "randomizer not supported";
  }

  const needParams = [
    "between",
    "betweens",
    "helpers",
    "fromCharacters",
    "utilities",
    "setDefaultRefDate",
    "seed",
    "constructor",
    "getMetadata",
  ];
  if (needParams.some((v) => `${categoryName}.${methodName}`.includes(v))) {
    return "need params";
  }

  let result;
  try {
    result = invoke(faker, `${categoryName}.${methodName}`);
  } catch (e) {
    console.log(e, `${categoryName}.${methodName}`);
    result = `occur some error, ${methodName}`;
    showFailureToast(result);
  }

  return result;
}

function openInBrowser(url: string) {
  try {
    console.log(`${url} was opened in default browser`);
  } catch (e) {
    console.log(e);
  }
}

interface Item {
  text: string;
  apiUrl: string;
  headers: HeaderItem[];
  headers2: string[];
}

interface HeaderItem {
  text: string;
  apiUrl: string;
  class: string;
  deprecated: boolean;
}

async function getData(url: string) {
  // const cached = cache.get("html");
  //
  // if (!cached) {
  //   const $ = await cheerio.fromURL("https://fakerjs.dev/api/");
  //   cache.set("html", $.html());
  // }
  //
  // const $$ = cheerio.load(cached!);
  const $ = await cheerio.fromURL(url);

  const versionInfo = $.extract({
    version: ".VPFlyout:nth-last-child(1) button",
  });

  const modules = $.extract({
    list: [
      {
        selector: ".api-group",
        value: {
          text: "h3 a",
          apiUrl: {
            selector: "h3 a",
            value: "href",
          },
          headers: [
            {
              selector: "ul li a",
              value: (el) => {
                const classVal = $(el).attr("class");
                const apiUrl = $(el).attr("href");
                const text = $(el).text();

                return {
                  text,
                  apiUrl,
                  class: classVal,
                  deprecated: !!classVal,
                };
              },
            },
          ],
          headers2: ["ul li"],
        },
      },
    ],
  });

  // const hasDeprecatedData = modules.list.filter((listO) =>
  //   listO.headers2.some((header) => {
  //     return header.depreciated;
  //   }),
  // );

  return {
    version: versionInfo.version,
    list: modules.list,
  };
}

export default function Command() {
  const abortable = useRef<AbortController>();
  const [showDetails, setShowDetails] = useCachedState<Item[]>("show-details", []);
  const [version, setVersion] = useCachedState<string>("");

  usePromise(
    async (url: string) => {
      const v = await getData(url);

      v && setShowDetails(v.list as Item[]);
      v && setVersion(v.version);
    },
    ["https://fakerjs.dev/api/"],
    {
      abortable,
    },
  );

  return (
    <List navigationTitle={`${version}`}>
      {showDetails?.map((item: Item, i: number) => (
        <List.Section title={item.text} key={`section-item-${i}`} subtitle={item.text}>
          {item.headers
            .filter((t: HeaderItem) => t.text !== "constructor" || !t.deprecated)
            .map((headerItem: HeaderItem, index: number) => (
              <List.Item
                key={`header-item-${index}`}
                title={`${headerItem.text}`}
                subtitle={`${item?.text?.toLowerCase()}.${headerItem?.text}`}
                accessories={[
                  {
                    text: { value: headerItem.deprecated ? `Deprecated` : "", color: Color.Orange },
                    icon: headerItem.deprecated ? Icon.Warning : null,
                  },
                  { tag: { value: new Date(), color: Color.Magenta } },
                ]}
                actions={
                  <ActionPanel title={`Let's play it`}>
                    <ActionPanel.Submenu icon={Icon.EyeDropper} title="Actions">
                      <Action
                        icon={{ source: Icon.Play, tintColor: Color.Green }}
                        title="Run it"
                        onAction={async () => {
                          await Clipboard.paste(runCommand(`${item.text.toLowerCase()}.${headerItem.text}`));
                        }}
                      />
                      <Action.OpenInBrowser
                        url={item.apiUrl}
                        icon={{ source: Icon.Window, tintColor: Color.Yellow }}
                        title="View in Browser"
                        onOpen={openInBrowser}
                      />
                    </ActionPanel.Submenu>
                  </ActionPanel>
                }
              ></List.Item>
            ))}
        </List.Section>
      ))}
    </List>
  );
}
