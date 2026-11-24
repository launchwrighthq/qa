import { z } from 'zod';

/** One leg (spec 2.3). The key of `qa.legs` is its name. */
declare const legConfig: z.ZodObject<{
    surface: z.ZodEnum<{
        web: "web";
        miniapp: "miniapp";
        bot: "bot";
    }>;
    target: z.ZodString;
    device: z.ZodOptional<z.ZodString>;
    descriptor: z.ZodOptional<z.ZodString>;
    viewport: z.ZodOptional<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, z.core.$strip>>;
    deviceScaleFactor: z.ZodOptional<z.ZodNumber>;
    userAgent: z.ZodOptional<z.ZodString>;
    browser: z.ZodOptional<z.ZodEnum<{
        chromium: "chromium";
        webkit: "webkit";
        firefox: "firefox";
    }>>;
    bot: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Config section `qa` (spec 2.2). */
declare const qaConfig: z.ZodObject<{
    reportDir: z.ZodDefault<z.ZodString>;
    database: z.ZodOptional<z.ZodString>;
    apiPort: z.ZodDefault<z.ZodNumber>;
    app: z.ZodDefault<z.ZodString>;
    telegramUrl: z.ZodDefault<z.ZodURL>;
    seed: z.ZodOptional<z.ZodString>;
    sessionRoute: z.ZodDefault<z.ZodString>;
    miniappSessionRoute: z.ZodDefault<z.ZodString>;
    clientRoots: z.ZodDefault<z.ZodArray<z.ZodString>>;
    buildDirs: z.ZodDefault<z.ZodArray<z.ZodString>>;
    baseUrls: z.ZodDefault<z.ZodRecord<z.ZodEnum<{
        web: "web";
        miniapp: "miniapp";
        bot: "bot";
    }> & z.core.$partial, z.ZodURL>>;
    routeTables: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        file: z.ZodString;
        surface: z.ZodEnum<{
            web: "web";
            miniapp: "miniapp";
            bot: "bot";
        }>;
    }, z.core.$strip>]>>>;
    routeWrappers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    states: z.ZodPrefault<z.ZodObject<{
        delivery: z.ZodOptional<z.ZodString>;
        mounts: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    typeRoots: z.ZodDefault<z.ZodArray<z.ZodString>>;
    legs: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        surface: z.ZodEnum<{
            web: "web";
            miniapp: "miniapp";
            bot: "bot";
        }>;
        target: z.ZodString;
        device: z.ZodOptional<z.ZodString>;
        descriptor: z.ZodOptional<z.ZodString>;
        viewport: z.ZodOptional<z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, z.core.$strip>>;
        deviceScaleFactor: z.ZodOptional<z.ZodNumber>;
        userAgent: z.ZodOptional<z.ZodString>;
        browser: z.ZodOptional<z.ZodEnum<{
            chromium: "chromium";
            webkit: "webkit";
            firefox: "firefox";
        }>>;
        bot: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodLiteral<false>]>>>;
    routes: z.ZodDefault<z.ZodBoolean>;
    evidence: z.ZodPrefault<z.ZodObject<{
        blankStdDev: z.ZodDefault<z.ZodNumber>;
        videoCapS: z.ZodDefault<z.ZodNumber>;
        blackRatio: z.ZodDefault<z.ZodNumber>;
        attempts: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    score: z.ZodPrefault<z.ZodObject<{
        weights: z.ZodDefault<z.ZodObject<{
            findings: z.ZodOptional<z.ZodNumber>;
            console: z.ZodOptional<z.ZodNumber>;
            coverage: z.ZodOptional<z.ZodNumber>;
            evidence: z.ZodOptional<z.ZodNumber>;
            accessibility: z.ZodOptional<z.ZodNumber>;
            performance: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>;
        gaugeColor: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    device: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    intake: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    publish: z.ZodPrefault<z.ZodObject<{
        storage: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
type QaConfig = z.infer<typeof qaConfig>;
type LegConfig = z.infer<typeof legConfig>;
/**
 * `cfg` with each `{app:<name>}` of its path keys (`app`, `clientRoots`, `buildDirs`,
 * `routeTables`, `typeRoots`, `states`) replaced by the folder of that app in config section `apps`.
 */
declare function withAppPaths(cfg: QaConfig, sections?: Record<string, unknown>): QaConfig;
/** Config section `qa` of `sections`, parsed, with the app folders of `withAppPaths`. */
declare function qaConfigOf(sections?: Record<string, unknown>): QaConfig;

export { type LegConfig as L, type QaConfig as Q, qaConfigOf as a, qaConfig as q, withAppPaths as w };
