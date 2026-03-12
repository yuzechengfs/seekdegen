import "react-native-get-random-values";
import "react-native-quick-crypto";
import { Buffer } from "buffer";
import { registerRootComponent } from "expo";
import App from "./App";

global.Buffer = Buffer;

registerRootComponent(App);
