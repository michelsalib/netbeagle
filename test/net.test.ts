import { expect, test } from "bun:test";
import {
	formatIPv6,
	hexIPv6,
	inNetwork,
	ipBytes,
	maskPrefix,
	networkOf,
	procIPv4,
	procIPv6,
} from "../src/net.ts";

test("IPv4 from /proc is in host order", () => {
	expect(procIPv4("0100007F")).toBe("127.0.0.1");
	expect(procIPv4("0A01A8C0")).toBe("192.168.1.10");
});

test("IPv6 from /proc: words in host order, mapped IPv4 unwrapped", () => {
	expect(procIPv6("00000000000000000000000001000000")).toEqual({
		family: 6,
		address: "::1",
	});
	expect(procIPv6("0000000000000000FFFF00000A01A8C0")).toEqual({
		family: 4,
		address: "192.168.1.10",
	});
	expect(hexIPv6("fe800000000000000000000000000000")).toBe("fe80::");
});

test("IPv6 text is canonical: the longest zero run becomes ::", () => {
	expect(formatIPv6(ipBytes("2001:db8:0:0:1:0:0:1") ?? [])).toBe(
		"2001:db8::1:0:0:1",
	);
	expect(formatIPv6(ipBytes("2001:db8:0:1:1:1:1:1") ?? [])).toBe(
		"2001:db8:0:1:1:1:1:1",
	);
	expect(ipBytes("::ffff:1.2.3.4")?.slice(12)).toEqual([1, 2, 3, 4]);
});

test("networks", () => {
	expect(inNetwork("192.168.1.77", "192.168.1.0", 24)).toBe(true);
	expect(inNetwork("192.168.2.1", "192.168.1.0", 24)).toBe(false);
	expect(inNetwork("10.0.0.1", "0.0.0.0", 0)).toBe(true);
	expect(inNetwork("::1", "0.0.0.0", 0)).toBe(false);
	expect(inNetwork("2001:db8::5", "2001:db8::", 32)).toBe(true);
	expect(networkOf({ family: 4, address: "172.20.83.30", prefix: 20 })).toBe(
		"172.20.80.0",
	);
	expect(maskPrefix("00F0FFFF")).toBe(20);
});
