"""统计项目文案中实际用到的字符，生成字体子集

用途：得意黑只用于标题，标题文案是静态的，因此可以把 8057 字的字体子集化到
只包含真正出现的字符，体积能从 1.1MB 降到几十 KB。

用法:
  python scripts/build-font-subset.py <源字体> <输出.woff2> [额外字符文件...]
"""
import sys
from pathlib import Path

# 标题/展示场景固定会用到的字符（数字、标点、单位）
EXTRA_CHARS = (
    "0123456789"
    "满分分他的生存指数第题共道约层级"
    "％%·—–-—…、。，！？：；（）「」『』《》【】“”‘’"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    " .,:;!?()[]{}#@&/\\|+*=<>~^$_"
)


def collect_chars(paths: list[str]) -> set[str]:
    chars: set[str] = set(EXTRA_CHARS)
    for p in paths:
        text = Path(p).read_text(encoding="utf-8")
        chars.update(text)
    return chars


def is_renderable(ch: str) -> bool:
    """去掉控制字符与空白（保留普通空格）"""
    if ch == " ":
        return True
    return ch.isprintable()


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    src = sys.argv[1]
    out = sys.argv[2]
    text_files = sys.argv[3:] or [
        "lib/copy.ts",
        "lib/brand.ts",
        "lib/levels.ts",
        "content/questions.ts",
    ]

    chars = {c for c in collect_chars(text_files) if is_renderable(c)}
    print(f"源文件      : {', '.join(text_files)}")
    print(f"唯一字符数  : {len(chars)}")

    from fontTools import subset
    from fontTools.ttLib import TTFont

    font = TTFont(src, fontNumber=0)
    cmap = font.getBestCmap()

    missing = sorted(c for c in chars if ord(c) not in cmap and c != " ")
    if missing:
        print(f"⚠ 字体缺失字符 ({len(missing)}): {''.join(missing[:40])}")

    options = subset.Options()
    options.flavor = "woff2"
    options.desubroutinize = True
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(sorted(chars)))
    subsetter.subset(font)

    Path(out).parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(out)

    src_size = Path(src).stat().st_size
    out_size = Path(out).stat().st_size
    print(f"输出        : {out}")
    print(
        f"体积        : {src_size / 1024:.0f} KB -> {out_size / 1024:.1f} KB "
        f"(压缩到 {out_size / src_size * 100:.1f}%)"
    )


if __name__ == "__main__":
    main()
