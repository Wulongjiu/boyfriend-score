"""检查字体的内部元数据（字体族名、字重、字符覆盖数）

用法: python scripts/inspect-font.py <font-file> [...]
"""
import sys
from fontTools.ttLib import TTFont


def inspect(path: str) -> None:
    try:
        font = TTFont(path, fontNumber=0, lazy=True)
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ 无法读取 {path}: {exc}")
        return

    name = font["name"]
    def get(nid: int) -> str:
        for plat, enc, lang in ((3, 1, 0x409), (1, 0, 0)):
            rec = name.getDebugName(nid)
            if rec:
                return rec
        return "(无)"

    print(f"  文件      : {path}")
    print(f"  家族名    : {get(1)}")
    print(f"  子家族    : {get(2)}")
    print(f"  全名      : {get(4)}")
    print(f"  版本      : {get(5)}")
    for nid, label in ((16, "排版家族"), (17, "排版子家族")):
        rec = name.getDebugName(nid)
        if rec:
            print(f"  {label}  : {rec}")

    # OS/2 权重
    if "OS/2" in font:
        os2 = font["OS/2"]
        weight = os2.usWeightClass
        width = os2.usWidthClass
        print(f"  字重等级  : {weight} (400=Regular, 700=Bold)")
        print(f"  宽度等级  : {width}")
        print(f"  fsSelection: {bin(os2.fsSelection)}")

    if "head" in font:
        mac = font["head"].macStyle
        print(f"  macStyle  : {bin(mac)}  (bit0=粗体, bit1=斜体)")

    # 字符覆盖
    cmap = font.getBestCmap()
    total = len(cmap)
    # 常用汉字区间
    cjk = sum(1 for cp in cmap if 0x4E00 <= cp <= 0x9FFF)
    print(f"  字形总数  : {total}")
    print(f"  汉字覆盖  : {cjk}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for p in sys.argv[1:]:
        inspect(p)
