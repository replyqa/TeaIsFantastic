#!/usr/bin/env node
import ora from "ora";
import YAML from 'yaml';
import minimist from 'minimist';

import { promisify } from "util";
import cp from "child_process";
import path from "path";
import fs from "fs";

const exec = promisify(cp.exec);
const rm = promisify(fs.rm);

const argv = minimist(process.argv.slice(2));
const file = fs.readFileSync(path.resolve(argv._[0]), 'utf8');
const yml = YAML.parse(file);
process.env.TISF_CONFIG = JSON.stringify(yml);

if (argv._.length < 1) {
  console.log("You have to provide the path to config.");
  console.log("For example :");
  console.log("    npx @tisf/run config.yml");
  process.exit(1);
}

const currentPath = process.cwd();
const projectPath = path.join(currentPath, "temp");
const git_repo = `https://github.com/${yml.meta.repo}`;

// create project directory
if (fs.existsSync(projectPath)) {
    fs.rmSync(projectPath, { recursive: true, force: true });
}

fs.mkdirSync(projectPath);

try {
  process.chdir(projectPath);
  const gitSpinner = ora("Downloading files...").start();
  // clone the repo into the project folder -> creates the new boilerplate
  await exec(`git clone -b ${yml.meta.branch} ${git_repo} . --quiet`);
  gitSpinner.succeed();

  const npmSpinner = ora("Installing dependencies...").start();
  await exec("npm install");
  npmSpinner.succeed();

  const runSpinner = ora("Running scripts...").start();
  const pth = path.join(projectPath, "index.js");
  console.log(pth);
  const forked = cp.fork(pth);
  forked.on('message', sum => {
    console.log(sum);
  });
  forked.on('exit', async (code,signal) => {
    runSpinner.succeed();
    if (code === 0) {
      delete process.env.TISF_CONFIG;
      process.chdir(currentPath);
      fs.rmdirSync(projectPath, { recursive: true, force: true });  
      console.log("The execution is done!");
    }
  });
} catch (error) {
  // clean up in case of error, so the user does not have to do it manually
  console.log(error);
}