import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/hotel-edit.css";

const LABEL_OPTIONS = [
  "免费停车",
  "亲子友好",
  "可带宠物",
  "豪华酒店",
  "商务出行",
  "近地铁",
  "含早餐",
  "泳池健身",
  "江景海景",
  "免费取消",
];

function authUser() {
  try {
    return JSON.parse(sessionStorage.getItem("authUser") || "null");
  } catch {
    return null;
  }
}

function formatDateForInput(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  } catch (e) {
    return String(value).slice(0, 10);
  }
}

export default function HotelEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [hotel, setHotel] = useState(null);
  const [saving, setSaving] = useState(false);
  const user = authUser();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (id === "0") {
      setHotel({
        id: "0",
        name: "",
        nameEn: "",
        province: "",
        city: "",
        county: "",
        address: "",
        openTime: "",
        starLevel: 4,
        intro: "",
        scenicSpots: [],
        featuredWeight: 0,
        labels: [],
        images: [],
      });
      return;
    }

    fetch(`/api/hotels/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((j) => {
        const h = j?.data;
        if (!h) return;
        setHotel({
          id: h.id,
          name: h.name || "",
          nameEn: h.nameEn || "",
          province: h.province || "",
          city: h.city || "",
          county: h.county || "",
          address: h.address || "",
          openTime: formatDateForInput(h.openTime || ""),
          starLevel: Number(h.starLevel || h.star || 4),
          intro: h.intro || "",
          scenicSpots: Array.isArray(h.scenicSpots) ? h.scenicSpots : [],
          featuredWeight: Number(h.featuredWeight || 0),
          labels: Array.isArray(h.labels) ? h.labels : [],
          images: Array.isArray(h.images) ? h.images : h.image ? [h.image] : [],
        });
      })
      .catch(() => setHotel(null));
  }, [id, navigate, user]);

  const canSubmit = useMemo(() => {
    if (!hotel) return false;
    return Boolean(
      hotel.name &&
      hotel.nameEn &&
      hotel.province &&
      hotel.city &&
      hotel.county &&
      hotel.address &&
      hotel.openTime,
    );
  }, [hotel]);

  function updateField(key, value) {
    setHotel((prev) => ({ ...prev, [key]: value }));
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => resolve(resizeTo16x9(img, 1280, 720));
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          }),
      ),
    ).then((images) => {
      setHotel((prev) => ({
        ...prev,
        images: [...prev.images, ...images.filter(Boolean)],
      }));
    });

    e.target.value = "";
  }

  function removeImage(idx) {
    setHotel((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  }

  function toggleLabel(label) {
    setHotel((prev) => {
      const has = prev.labels.includes(label);
      return {
        ...prev,
        labels: has
          ? prev.labels.filter((x) => x !== label)
          : [...prev.labels, label],
      };
    });
  }

  async function handleSubmit() {
    if (!canSubmit) {
      alert("请完整填写必填项");
      return;
    }

    const payload = {
      merchantId: user?.id,
      name: hotel.name,
      nameEn: hotel.nameEn,
      province: hotel.province,
      city: hotel.city,
      county: hotel.county,
      address: hotel.address,
      openTime: hotel.openTime,
      starLevel: Number(hotel.starLevel || 4),
      intro: hotel.intro,
      scenicSpots: hotel.scenicSpots,
      featuredWeight: Number(hotel.featuredWeight || 0),
      labels: hotel.labels,
      image: hotel.images[0] || "",
      images: hotel.images,
    };

    setSaving(true);
    try {
      if (id === "0") {
        const res = await fetch("/api/hotels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.msg || "保存失败");
        if (j?.data?.id) {
          navigate(`/hotels/${j.data.id}/rooms`);
          return;
        }
      } else {
        const res = await fetch(`/api/hotels/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok) throw new Error(j?.msg || "保存失败");
        navigate(`/hotels/${id}`);
        return;
      }
      alert("保存失败");
    } catch (e) {
      alert(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!hotel)
    return (
      <div className="container">
        <div className="empty-tip">加载中或未找到酒店</div>
      </div>
    );

  return (
    <div>
      <div className="top-nav">
        <div className="nav-logo">
          <div className="logo-icon">🏨</div>
          <span>易宿酒店录入</span>
        </div>
        <div className="user-info">
          <button className="logout-btn" onClick={() => navigate("/dashboard")}>
            返回工作台
          </button>
        </div>
      </div>

      <div className="container">
        <div className="page-title">
          <button className="btn-back" onClick={() => navigate("/dashboard")}>
            ← 返回酒店列表
          </button>
          <span>{id === "0" ? "新增酒店信息" : "编辑酒店信息"}</span>
        </div>

        <div className="form-card">
          <div className="form-grid">
            <div className="form-item">
              <label className="form-label required">酒店中文名</label>
              <input
                className="form-input"
                value={hotel.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
            <div className="form-item">
              <label className="form-label required">酒店英文名</label>
              <input
                className="form-input"
                value={hotel.nameEn}
                onChange={(e) => updateField("nameEn", e.target.value)}
              />
            </div>
            <div className="form-item">
              <label className="form-label required">省份</label>
              <input
                className="form-input"
                value={hotel.province}
                onChange={(e) => updateField("province", e.target.value)}
              />
            </div>
            <div className="form-item">
              <label className="form-label required">城市</label>
              <input
                className="form-input"
                value={hotel.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>
            <div className="form-item">
              <label className="form-label required">区县</label>
              <input
                className="form-input"
                value={hotel.county}
                onChange={(e) => updateField("county", e.target.value)}
              />
            </div>
            <div className="form-item">
              <label className="form-label required">开业日期</label>
              <input
                type="date"
                className="form-input"
                value={formatDateForInput(hotel.openTime)}
                onChange={(e) => updateField("openTime", e.target.value)}
              />
            </div>
            <div className="form-item">
              <label className="form-label required">酒店星级</label>
              <select
                className="form-select"
                value={hotel.starLevel}
                onChange={(e) => updateField("starLevel", e.target.value)}
              >
                <option value={3}>3星</option>
                <option value={4}>4星</option>
                <option value={5}>5星</option>
              </select>
            </div>
            <div className="form-item">
              <label className="form-label">广告权重</label>
              <input
                className="form-input"
                type="number"
                value={hotel.featuredWeight}
                onChange={(e) => updateField("featuredWeight", e.target.value)}
              />
            </div>
            <div className="form-item" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label required">详细地址</label>
              <input
                className="form-input"
                value={hotel.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
            </div>
            <div className="form-item" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">附近景点（回车分隔）</label>
              <input
                className="form-input"
                value={(hotel.scenicSpots || []).join("，")}
                onChange={(e) =>
                  updateField(
                    "scenicSpots",
                    e.target.value
                      .split(/[，,]/)
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
            </div>
            <div className="form-item" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">酒店简介</label>
              <textarea
                className="form-textarea"
                value={hotel.intro}
                onChange={(e) => updateField("intro", e.target.value)}
              />
            </div>

            <div className="form-item" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">酒店标签</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {LABEL_OPTIONS.map((label) => (
                  <label
                    key={label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hotel.labels.includes(label)}
                      onChange={() => toggleLabel(label)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-item" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">酒店配图（Banner多图）</label>
              <div className="image-section-title">
                按上传顺序作为详情页轮播顺序
              </div>
              <div className="image-uploader">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFiles}
                />
              </div>
              <div className="image-gallery">
                {hotel.images.length ? (
                  hotel.images.map((image, idx) => (
                    <div
                      className="image-item"
                      key={`${idx}-${image.slice(0, 24)}`}
                    >
                      <img src={image} alt={`hotel-${idx}`} />
                      <button
                        type="button"
                        className="image-remove"
                        onClick={() => removeImage(idx)}
                      >
                        删除
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="form-tip">暂无图片</div>
                )}
              </div>
            </div>
          </div>

          <div className="btn-group">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving || !canSubmit}
            >
              {saving ? "提交中..." : "保存并提交审核"}
            </button>
            {id !== "0" && (
              <button
                type="button"
                className="btn btn-default"
                onClick={() => navigate(`/hotels/${id}/rooms`)}
              >
                编辑房型
              </button>
            )}
            <button
              type="button"
              className="btn btn-default"
              onClick={() => window.location.reload()}
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function resizeTo16x9(img, targetW, targetH) {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const targetRatio = targetW / targetH;
  const srcRatio = srcW / srcH;

  let drawW;
  let drawH;
  if (srcRatio > targetRatio) {
    drawH = targetH;
    drawW = srcW * (drawH / srcH);
  } else {
    drawW = targetW;
    drawH = srcH * (drawW / srcW);
  }

  const offsetX = (targetW - drawW) / 2;
  const offsetY = (targetH - drawH) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  return canvas.toDataURL("image/jpeg", 0.9);
}
