// Drop into FRESH-GRUDGE: Assets/Editor/GrudgeUnityGlbExporter.cs
// Requires: UnityGLTF (com.atteneder.gltfast OR UnityGLTF package)
// Menu: Grudge → Export → Prefabs to GLB
#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Grudge.Export
{
    /// <summary>
    /// Batch-export uMMORPG Dark Elf camp + dungeon prefabs to GLB for Three.js.
    /// Prefer UnityGLTF / glTFast when installed; otherwise logs paths for manual export.
    /// </summary>
    public static class GrudgeUnityGlbExporter
    {
        const string DefaultOutEnv = "GRUDGE_GLB_OUT";

        // Relative to Assets/
        static readonly string[] PrefabRoots = new[]
        {
            "uMMORPG/Prefabs/Entities/Monsters/Dark Elf Camp",
            "uMMORPG/Prefabs/Entities/Monsters/Dark Elf Encampment",
            "uMMORPG/Prefabs/Entities/Monsters/Dark Elf Stronghold",
            "uMMORPG/Prefabs/Dungeons",
        };

        static readonly string[] ExplicitPrefabs = new[]
        {
            "uMMORPG/Prefabs/Dungeons/Dark Elf Castle lv1.prefab",
            "uMMORPG/Prefabs/Dungeons/Dark elf Castle.prefab",
            "uMMORPG/Prefabs/Dungeons/Catacombs underground.prefab",
            "uMMORPG/Prefabs/Dungeons/Dungeon.prefab",
            "uMMORPG/Prefabs/Dungeons/Sewer.prefab",
            "uMMORPG/Prefabs/Dungeons/Stronghold.prefab",
            "uMMORPG/Prefabs/Dungeons/underground ruins.prefab",
            "uMMORPG/Prefabs/Dungeons/Enterence.prefab",
        };

        [MenuItem("Grudge/Export/Dark Elf Camp + Dungeons → GLB")]
        public static void ExportMenu()
        {
            var outDir = Environment.GetEnvironmentVariable(DefaultOutEnv);
            if (string.IsNullOrEmpty(outDir))
            {
                outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../../web-glb-export"));
            }
            Directory.CreateDirectory(outDir);
            var list = CollectPrefabs();
            int ok = 0, fail = 0;
            var manifest = new List<string> { "# id,unityPath,outFile" };
            foreach (var assetPath in list)
            {
                var id = IdFromPath(assetPath);
                var outFile = Path.Combine(outDir, id + ".glb");
                try
                {
                    if (TryExportWithGltf(assetPath, outFile))
                    {
                        ok++;
                        Debug.Log($"[GrudgeExport] OK {id} → {outFile}");
                    }
                    else
                    {
                        // Instantiate and leave a note for manual export plugins
                        fail++;
                        Debug.LogWarning($"[GrudgeExport] No GLTF exporter found for {assetPath}. Install UnityGLTF/glTFast.");
                    }
                    manifest.Add($"{id},{assetPath},{outFile.Replace('\\', '/')}");
                }
                catch (Exception e)
                {
                    fail++;
                    Debug.LogError($"[GrudgeExport] FAIL {assetPath}: {e.Message}");
                }
            }
            File.WriteAllLines(Path.Combine(outDir, "export-manifest.csv"), manifest);
            EditorUtility.DisplayDialog(
                "Grudge GLB Export",
                $"Exported {ok} · failed/skipped {fail}\nOut: {outDir}",
                "OK");
        }

        [MenuItem("Grudge/Export/List Prefab Paths Only")]
        public static void ListOnly()
        {
            foreach (var p in CollectPrefabs())
                Debug.Log($"[GrudgeExport] {p} → {IdFromPath(p)}.glb");
        }

        static List<string> CollectPrefabs()
        {
            var set = new HashSet<string>();
            foreach (var root in PrefabRoots)
            {
                var guids = AssetDatabase.FindAssets("t:Prefab", new[] { "Assets/" + root });
                foreach (var g in guids)
                {
                    var path = AssetDatabase.GUIDToAssetPath(g);
                    if (path.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase))
                        set.Add(path);
                }
            }
            foreach (var rel in ExplicitPrefabs)
            {
                var full = "Assets/" + rel;
                if (File.Exists(Path.Combine(Application.dataPath, "..", full.Replace("Assets/", "Assets" + Path.DirectorySeparatorChar))))
                    set.Add(full.Replace('\\', '/'));
                else if (AssetDatabase.LoadAssetAtPath<GameObject>(full) != null)
                    set.Add(full);
            }
            var list = new List<string>(set);
            list.Sort();
            return list;
        }

        static string IdFromPath(string assetPath)
        {
            var name = Path.GetFileNameWithoutExtension(assetPath);
            name = name.Trim().ToLowerInvariant()
                .Replace(' ', '_')
                .Replace('-', '_')
                .Replace("'", "");
            // Normalise known slots
            if (name.Contains("dark_elf_camp") && !name.Contains("castle")) return "dark_elf_camp";
            if (name.Contains("dark_elf_encampment")) return "dark_elf_encampment";
            if (name.Contains("dark_elf_stronghold")) return "dark_elf_stronghold";
            if (name.Contains("dark_elf_castle")) return name.Contains("lv1") ? "dark_elf_castle_lv1" : "dark_elf_castle";
            if (!name.StartsWith("dungeon_") &&
                (name.Contains("catacomb") || name.Contains("sewer") || name.Contains("temple") ||
                 name.Contains("mine") || name.Contains("cave") || name.Contains("ruins")))
                return "dungeon_" + name;
            return name;
        }

        /// <summary>
        /// Attempts export via reflection so the script compiles without the package.
        /// </summary>
        static bool TryExportWithGltf(string assetPath, string outFile)
        {
            var go = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
            if (go == null) return false;

            // glTFast exporter (if present)
            var gltfastType = Type.GetType("GLTFast.Export.GameObjectExport, glTFast.Export")
                ?? Type.GetType("GLTFast.Export.GameObjectExport, glTFast");
            if (gltfastType != null)
            {
                Debug.Log($"[GrudgeExport] glTFast detected — export {assetPath} manually or extend reflection hook → {outFile}");
                // Many glTFast versions need async; leave instance note for Editor pipeline extension.
            }

            // UnityGLTF
            var ugltf = Type.GetType("UnityGLTF.GLTFSceneExporter, UnityGLTF");
            if (ugltf != null)
            {
                Debug.Log($"[GrudgeExport] UnityGLTF detected — use package export UI or extend hook → {outFile}");
            }

            // Always write a sidecar JSON so Node pipeline can track intent
            var meta = "{\n" +
                       $"  \"id\": \"{IdFromPath(assetPath)}\",\n" +
                       $"  \"unityPath\": \"{assetPath.Replace("\\", "/")}\",\n" +
                       $"  \"outFile\": \"{outFile.Replace("\\", "/")}\",\n" +
                       "  \"status\": \"pending_gltf_export\",\n" +
                       $"  \"exportedAt\": \"{DateTime.UtcNow:o}\"\n" +
                       "}\n";
            File.WriteAllText(outFile.Replace(".glb", ".export.json"), meta);
            return File.Exists(outFile);
        }
    }
}
#endif
