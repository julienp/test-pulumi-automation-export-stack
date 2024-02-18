import * as pulumi from "@pulumi/pulumi";
import {
  LocalProgramArgs,
  LocalWorkspace,
  LocalWorkspaceOptions,
} from "@pulumi/pulumi/automation";

const args = process.argv.slice(2);
let destroy = false;
if (args.length > 0 && args[0]) {
  destroy = args[0] === "destroy";
}

type MyComponentArgs = {
  secret: pulumi.Input<string>;
  plaintext: pulumi.Input<string>;
};

class MyComponent extends pulumi.ComponentResource {
  private readonly secret: pulumi.Output<string>;
  private readonly plaintext: pulumi.Output<string>;
  constructor(name: string, args: MyComponentArgs, opts: pulumi.ComponentResourceOptions) {
    super("pkg:index:MyComponent", name, args, opts);
    this.plaintext = pulumi.output(args.plaintext);
    this.secret = pulumi.output(args.secret);
    this.registerOutputs({
      secret: this.secret,
      plaintext: this.plaintext,
    });
  }
}

const run = async () => {
  const pulumiProgram = async () => {
    const config = new pulumi.Config()
    const plaintext = config.require("my-plaintext-key");
    const secret = config.requireSecret("my-secret-key");
    const myComponent = new MyComponent("myComponent", { secret, plaintext }, { parent: pulumi.rootStackResource });
    return {
      plaintext,
      secret,
      myComponent,
    };
  };

  const workspaceOpts: LocalWorkspaceOptions = {
    program: pulumiProgram,
    projectSettings: {
      name: "auto-test-export-stack",
      runtime: "nodejs"
    },
  };

  const programArgs: LocalProgramArgs = {
    stackName: "dev",
    workDir: ".",
  };

  const stack = await LocalWorkspace.createOrSelectStack(
    programArgs,
    workspaceOpts
  );

  if (destroy) {
    console.info("destroying stack...");
    await stack.destroy({ onOutput: console.info });
    console.info("stack destroy complete");
    process.exit(0);
  }

  await stack.setConfig("my-plaintext-key", { value: "my-plaintext-value" });
  await stack.setConfig("my-secret-key", { value: "my-secret-value", secret: true });

  console.info("updating stack...");
  const upRes = await stack.up({ onOutput: console.info });
  console.log(
    `update summary: \n${JSON.stringify(
      upRes.summary.resourceChanges,
      null,
      4
    )
    }`
  );

  const s = await stack.exportStack()
  console.log(`stack: ${JSON.stringify(s, null, 2)}`)
};

run().catch((err) => console.log(err));
