import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createProfilesActor, optToText, textToOpt } from "../profilesApi.js";
import { createEventsActor } from "../events.js";
import { createAlbumsActor } from "../albums.js";
import { createRecipesActor } from "../recipesApi.js";
import { createVotesActor } from "../votes.js";
import { createWalletActor } from "../walletApi.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import { Principal } from "@icp-sdk/core/principal";
import StyledUserName from "../components/StyledUserName.jsx";
import { createShopActor } from "../shopApi.js";
import { createWallActor } from "../wall.js";
import { ThumbsUpIcon, ThumbsDownIcon, HeartIcon } from "../components/ReactionIcons.jsx";
import { useTopBarActions } from "../context/TopBarActionsContext.jsx";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

export default function Profile() {
  const { userId } = useParams();
  const { identity, profile } = useAuth();
  const [person, setPerson] = useState(null);
  const [details, setDetails] = useState(null);
  const [activity, setActivity] = useState([]);
  const [chefInfo, setChefInfo] = useState(null);
  const [targetShopProfile, setTargetShopProfile] = useState(null);
  const [loveBalance, setLoveBalance] = useState(null);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [wallPosts, setWallPosts] = useState([]);
  const [wallText, setWallText] = useState("");
  const [wallFile, setWallFile] = useState(null);
  const [wallPosting, setWallPosting] = useState(false);
  const [wallError, setWallError] = useState(null);
  const wallFileInputRef = useRef(null);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [telephone, setTelephone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isSelf = profile && profile.id.toString() === userId;
  const isAdmin = profile && "admin" in profile.role;
  const { setAction } = useTopBarActions() || {};

  const refresh = useCallback(async () => {
    if (!identity || !userId) return;
    try {
      const targetPrincipal = Principal.fromText(userId);
      const [authActor, profilesActor, shopActor] = await Promise.all([
        createAuthActor(identity),
        createProfilesActor(identity),
        createShopActor(identity),
      ]);
      const [userResult, detailsResult, shopResult] = await Promise.all([
        authActor.getUser(targetPrincipal),
        profilesActor.getProfileDetails(targetPrincipal),
        shopActor.getShopProfileFor(targetPrincipal),
      ]);
      setTargetShopProfile(shopResult);
      setPerson(userResult.length > 0 ? userResult[0] : null);
      setDetails(detailsResult);

      setAddress(optToText(detailsResult.address) || "");
      setPostalCode(optToText(detailsResult.postalCode) || "");
      setTelephone(optToText(detailsResult.telephone) || "");
      setWhatsapp(optToText(detailsResult.whatsapp) || "");
      setEmail(optToText(detailsResult.email) || "");
      setDescription(optToText(detailsResult.description) || "");

      // Chef check
      try {
        const recipesActor = await createRecipesActor(identity);
        const chefResult = await recipesActor.getChefSummary(targetPrincipal);
        setChefInfo(chefResult.length > 0 && Number(chefResult[0].recipeCount) > 0 ? chefResult[0] : null);
      } catch (e) {
        setChefInfo(null);
      }

      // Love balance — private, only fetched/shown on your own profile.
      if (isSelf) {
        try {
          const walletActor = await createWalletActor(identity);
          const love = await walletActor.getMyLove();
          setLoveBalance(love);
        } catch (e) {
          setLoveBalance(null);
        }
      }

      // Recent activity — aggregate from events, albums, recipes, votes.
      const items = [];
      try {
        const eventsActor = await createEventsActor(identity);
        const events = await eventsActor.getVisibleEvents();
        events
          .filter((e) => e.creator.toString() === userId)
          .forEach((e) => items.push({ type: "Event", label: e.title, link: "/events/" + e.id.toString(), timestamp: Number(e.created) }));
      } catch (e) {}
      try {
        const albumsActor = await createAlbumsActor(identity);
        const albums = await albumsActor.listAlbums();
        albums
          .filter((a) => a.creator.toString() === userId)
          .forEach((a) => items.push({ type: "Album", label: a.name, link: "/albums/" + a.id.toString(), timestamp: Number(a.created) }));
      } catch (e) {}
      try {
        const recipesActor = await createRecipesActor(identity);
        const recipes = await recipesActor.listRecipes();
        recipes
          .filter((r) => r.recipe.creator.toString() === userId)
          .forEach((r) => items.push({ type: "Recipe", label: r.recipe.title, link: "/recipes/" + r.recipe.id.toString(), timestamp: Number(r.recipe.created) }));
      } catch (e) {}
      try {
        const votesActor = await createVotesActor(identity);
        const polls = await votesActor.listPollsWithResults();
        polls
          .filter((p) => p.poll.creator.toString() === userId)
          .forEach((p) => items.push({ type: "Vote", label: p.poll.title, link: "/votes/" + p.poll.id.toString(), timestamp: Number(p.poll.created) }));
      } catch (e) {}

      items.sort((a, b) => b.timestamp - a.timestamp);
      setActivity(items.slice(0, 12));
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [identity, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshWall = useCallback(async () => {
    if (!identity || !userId) return;
    try {
      const wallActor = await createWallActor(identity);
      const targetPrincipal = Principal.fromText(userId);
      const result = await wallActor.getWallPosts(targetPrincipal);
      const sorted = [...result].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
      setWallPosts(sorted);
    } catch (e) {}
  }, [identity, userId]);

  useEffect(() => {
    refreshWall();
  }, [refreshWall]);

  useEffect(() => {
    if (!setAction) return;
    if (isSelf) {
      setAction(
        <button className="chat-send-button" onClick={() => setEditing((e) => !e)}>
          {editing ? "Cancel Editing" : "Edit Profile"}
        </button>
      );
    } else {
      setAction(null);
    }
    return () => setAction(null);
  }, [setAction, isSelf, editing]);

  const handleWallFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setWallError("Only PNG or JPG images are supported.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setWallError("Photo is too large.");
      e.target.value = "";
      return;
    }
    setWallError(null);
    setWallFile(f);
  };

  const handlePostToWall = async (e) => {
    e.preventDefault();
    if (!identity) return;
    if (!wallText.trim() && !wallFile) return;
    setWallPosting(true);
    setWallError(null);
    try {
      const wallActor = await createWallActor(identity);
      const targetPrincipal = Principal.fromText(userId);
      let attachment = [];
      if (wallFile) {
        const a = await fileToAttachment(wallFile);
        attachment = [a];
      }
      const ok = await wallActor.postToWall(targetPrincipal, wallText.trim(), attachment);
      if (!ok) {
        setWallError(isSelf ? "Could not post." : "Could not post — check your Love balance (posting costs 2 Love).");
      } else {
        setWallText("");
        setWallFile(null);
        if (wallFileInputRef.current) wallFileInputRef.current.value = "";
        await refreshWall();
      }
    } catch (e2) {
      setWallError("Something went wrong. Please try again.");
    } finally {
      setWallPosting(false);
    }
  };

  const handleReactWallPost = async (postId, isThumbsUp) => {
    if (!identity) return;
    try {
      const wallActor = await createWallActor(identity);
      await wallActor.reactToWallPost(postId, isThumbsUp);
      await refreshWall();
    } catch (e) {}
  };

  const handleLoveWallPost = async (postId) => {
    if (!identity) return;
    try {
      const wallActor = await createWallActor(identity);
      await wallActor.loveWallPost(postId);
      await refreshWall();
    } catch (e) {}
  };

  const handleDeleteWallPost = async (postId) => {
    if (!identity) return;
    try {
      const wallActor = await createWallActor(identity);
      await wallActor.deleteWallPost(postId);
      await refreshWall();
    } catch (e) {}
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!identity) return;
    setSaving(true);
    setError(null);
    try {
      const profilesActor = await createProfilesActor(identity);
      await profilesActor.updateProfileDetails(
        textToOpt(address),
        textToOpt(postalCode),
        textToOpt(telephone),
        textToOpt(whatsapp),
        textToOpt(email),
        textToOpt(description)
      );
      setEditing(false);
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !identity) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Only PNG or JPG photos are supported.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Photo is too large (max ~3.3MB).");
      e.target.value = "";
      return;
    }
    if (details && details.photos.length >= 10) {
      setError("You can have up to 10 photos.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const profilesActor = await createProfilesActor(identity);
      const attachment = await fileToAttachment(f);
      await profilesActor.addPhoto(attachment);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (index) => {
    if (!identity) return;
    setError(null);
    try {
      const profilesActor = await createProfilesActor(identity);
      if (isSelf) {
        await profilesActor.removePhoto(index);
      } else {
        await profilesActor.adminRemovePhoto(person.id, index);
      }
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  if (error) return <p className="auth-error">{error}</p>;
  if (!person || !details) return <p className="chat-empty">Loading...</p>;

  const contactRows = [
    { label: "Address", value: optToText(details.address) },
    { label: "Postal Code", value: optToText(details.postalCode) },
    { label: "Telephone", value: optToText(details.telephone) },
    { label: "WhatsApp", value: optToText(details.whatsapp) },
    { label: "Email", value: optToText(details.email) },
  ].filter((r) => r.value);

  const descText = optToText(details.description);

  const themeClass =
    targetShopProfile && targetShopProfile.profileThemeOwned && targetShopProfile.profileTheme
      ? "shop-theme-wrapper shop-theme-" + targetShopProfile.profileTheme
      : "";

  const hasBanner = targetShopProfile && targetShopProfile.bannerOwned && targetShopProfile.bannerPhoto.length > 0;
  const hasAvatar = targetShopProfile && targetShopProfile.pfpOwned && targetShopProfile.avatarPhoto.length > 0;

  const renderSidePanel = () => (
    <div className="profile-side-panel">
      {contactRows.length > 0 && (
        <div className="profile-info-pill">
          {contactRows.map((r) => (
            <div key={r.label}>
              <strong>{r.label}:</strong> {r.value}
            </div>
          ))}
        </div>
      )}
      <button className="profile-pill-btn" type="button" onClick={() => setShowPhotosModal(true)}>
        📷 Photos ({details.photos.length})
      </button>
      <button className="profile-pill-btn profile-pill-btn-stacked" type="button" onClick={() => setShowActivityModal(true)}>
        Recent<br />Activity
      </button>
    </div>
  );

  const leftGroup = (
    <div className="profile-identity-left-group">
      {!hasBanner && hasAvatar && (
        <img
          className="shop-avatar shop-avatar-large"
          src={attachmentToUrl(targetShopProfile.avatarPhoto[0])}
          alt={person.username}
        />
      )}
      <h1 className="page-title profile-identity-name">
        <StyledUserName userId={userId} name={person.username} isMe={true} myShopProfile={targetShopProfile} hideAvatar={hasAvatar} />
      </h1>
    </div>
  );

  return (
    <div className={"profile-root" + (hasBanner ? " profile-has-banner" : "") + " " + themeClass}>
      {hasBanner && (
        <div className="profile-header">
          <img className="shop-banner" src={attachmentToUrl(targetShopProfile.bannerPhoto[0])} alt="Profile banner" />
          {hasAvatar && (
            <div className="profile-banner-overlay">
              <img
                className="shop-avatar shop-avatar-large"
                src={attachmentToUrl(targetShopProfile.avatarPhoto[0])}
                alt={person.username}
              />
            </div>
          )}
        </div>
      )}
      <div className="profile-pills-row">
        {renderSidePanel()}
      </div>
      <div className="profile-username-row">
        {leftGroup}
      </div>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        {descText || ("admin" in person.role ? "Family Hub admin" : "Family member")}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {!isSelf && (
          <Link to={"/dms/" + userId} className="chat-send-button" style={{ textDecoration: "none" }}>
            Message {person.username}
          </Link>
        )}
        {chefInfo && (
          <Link to={"/recipes/chef/" + userId} className="chat-send-button" style={{ textDecoration: "none" }}>
            🍳 View Chef Page
          </Link>
        )}
      </div>

      {editing && isSelf && (
        <form onSubmit={handleSaveDetails} className="tree-admin-panel" style={{ marginBottom: 20 }}>
          <h2 className="tree-admin-title">Edit your info</h2>
          <p className="tree-rel" style={{ marginBottom: 12 }}>
            All fields are optional. Leave blank to keep it private — nothing will show on your profile either way.
          </p>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#8a7860" }}>Address</label>
          <input className="chat-text-input" style={{ width: "100%", marginBottom: 10 }} value={address} onChange={(e) => setAddress(e.target.value)} />
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#8a7860" }}>Postal Code</label>
          <input className="chat-text-input" style={{ width: "100%", marginBottom: 10 }} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#8a7860" }}>Telephone Number</label>
          <input className="chat-text-input" style={{ width: "100%", marginBottom: 10 }} value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#8a7860" }}>WhatsApp Number</label>
          <input className="chat-text-input" style={{ width: "100%", marginBottom: 10 }} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#8a7860" }}>Email</label>
          <input className="chat-text-input" style={{ width: "100%", marginBottom: 10 }} value={email} onChange={(e) => setEmail(e.target.value)} />
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#8a7860" }}>Description</label>
          <textarea className="chat-text-input" style={{ width: "100%", marginBottom: 10, minHeight: 80, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="chat-send-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      )}

      {showPhotosModal && (
        <div className="chat-pinned-modal-overlay" onClick={() => setShowPhotosModal(false)}>
          <div className="chat-pinned-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-pinned-modal-header">
              <h2 className="tree-admin-title" style={{ margin: 0 }}>Photos</h2>
              <button className="delete-x-btn" onClick={() => setShowPhotosModal(false)} title="Close">✕</button>
            </div>
            {isSelf && (
              <div style={{ marginBottom: 12 }}>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handlePhotoUpload} disabled={uploading || details.photos.length >= 10} />
                {uploading && <span className="tree-rel" style={{ marginLeft: 8 }}>Uploading...</span>}
                <div className="tree-rel" style={{ marginTop: 4 }}>{details.photos.length}/10 photos</div>
              </div>
            )}
            {details.photos.length === 0 ? (
              <p className="chat-empty">No photos yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                {details.photos.map((p, i) => {
                  const url = attachmentToUrl(p);
                  return (
                    <div key={i}>
                      <img
                        src={url}
                        alt="Profile"
                        className="zoomable-image"
                        style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10 }}
                        onClick={() => {
                          setLightboxIndex(i);
                          setLightboxSrc(url);
                        }}
                      />
                      {(isSelf || isAdmin) && (
                        <button className="tree-remove-btn" style={{ marginTop: 4, width: "100%" }} onClick={() => handleRemovePhoto(i)}>
                          {isSelf ? "Remove" : "Remove (admin)"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="chat-pinned-modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="chat-pinned-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-pinned-modal-header">
              <h2 className="tree-admin-title" style={{ margin: 0 }}>Recent Activity</h2>
              <button className="delete-x-btn" onClick={() => setShowActivityModal(false)} title="Close">✕</button>
            </div>
            {activity.length === 0 ? (
              <p className="chat-empty">No recent activity.</p>
            ) : (
              activity.map((item, i) => (
                <Link
                  key={i}
                  to={item.link}
                  className="chat-message"
                  style={{ display: "block", marginBottom: 8, textDecoration: "none", color: "inherit" }}
                  onClick={() => setShowActivityModal(false)}
                >
                  <span className="tree-rel">{item.type}</span> — <strong>{item.label}</strong>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      <h2 className="tree-admin-title">Wall</h2>
      <form onSubmit={handlePostToWall} className="tree-admin-panel" style={{ marginBottom: 16 }}>
        {!isSelf && (
          <p className="tree-rel" style={{ marginBottom: 8 }}>Posting here costs 2 Love.</p>
        )}
        <textarea
          className="chat-text-input"
          style={{ width: "100%", minHeight: 60, resize: "vertical", marginBottom: 8 }}
          placeholder={isSelf ? "Write something on your own wall..." : "Write something on " + (person ? person.username : "their") + "'s wall..."}
          value={wallText}
          onChange={(e) => setWallText(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            ref={wallFileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleWallFileChange}
            style={{ display: "none" }}
            id="wall-file-input"
          />
          <label htmlFor="wall-file-input" className="chat-attach-button">Attach</label>
          <button className="chat-send-button" type="submit" disabled={wallPosting}>
            {wallPosting ? "Posting..." : isSelf ? "Post" : "Post (2 Love)"}
          </button>
        </div>
        {wallFile && <div className="chat-file-preview">Attached: {wallFile.name}</div>}
        {wallError && <p className="auth-error">{wallError}</p>}
      </form>

      {wallPosts.length === 0 ? (
        <p className="chat-empty">No wall posts yet.</p>
      ) : (
        wallPosts.map((post) => {
          const isMeAuthor = profile && post.author.toString() === profile.id.toString();
          const canDelete =
            profile &&
            (post.author.toString() === profile.id.toString() ||
              post.wallOwner.toString() === profile.id.toString() ||
              isAdmin);
          const postAttachment = post.attachment.length > 0 ? post.attachment[0] : null;
          return (
            <div key={post.id.toString()} className="chat-message chat-message-wall" style={{ marginBottom: 10, position: "relative" }}>
              <div className="chat-message-sender">
                <Link to={"/profile/" + post.author.toString()}>
                  <StyledUserName
                    userId={post.author}
                    name={post.authorName}
                    isMe={isMeAuthor}
                    myShopProfile={isSelf ? targetShopProfile : null}
                  />
                </Link>
              </div>
              {post.text ? <div className="chat-message-text">{post.text}</div> : null}
              {postAttachment ? (
                <img
                  className="chat-attachment-image zoomable-image"
                  src={attachmentToUrl(postAttachment)}
                  alt={postAttachment.filename}
                  onClick={() => setLightboxSrc(attachmentToUrl(postAttachment))}
                />
              ) : null}
              <div className="chat-reaction-row">
                <button
                  className={"chat-reaction-btn chat-reaction-btn-up" + (post.myReaction.length > 0 && post.myReaction[0] === true ? " chat-reaction-active" : "")}
                  onClick={() => handleReactWallPost(post.id, true)}
                  disabled={isMeAuthor || post.myReaction.length > 0}
                  type="button"
                >
                  <ThumbsUpIcon />
                  <span>{post.thumbsUpCount.toString()}</span>
                </button>
                <button
                  className={"chat-reaction-btn chat-reaction-btn-down" + (post.myReaction.length > 0 && post.myReaction[0] === false ? " chat-reaction-active" : "")}
                  onClick={() => handleReactWallPost(post.id, false)}
                  disabled={isMeAuthor || post.myReaction.length > 0}
                  type="button"
                >
                  <ThumbsDownIcon />
                  <span>{post.thumbsDownCount.toString()}</span>
                </button>
                <button
                  className={"chat-reaction-btn chat-reaction-btn-love" + (post.myLoveGiven ? " chat-reaction-active" : "")}
                  onClick={() => handleLoveWallPost(post.id)}
                  disabled={isMeAuthor || post.myLoveGiven}
                  type="button"
                >
                  <HeartIcon />
                  <span>{post.loveCount.toString()}</span>
                </button>
              </div>
              {canDelete && (
                <button className="delete-x-btn" onClick={() => handleDeleteWallPost(post.id)} title="Delete">
                  ✕
                </button>
              )}
            </div>
          );
        })
      )}

      <Lightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
        images={details.photos.map((p) => attachmentToUrl(p))}
        index={lightboxIndex}
        onNavigate={(newIndex) => {
          setLightboxIndex(newIndex);
          setLightboxSrc(attachmentToUrl(details.photos[newIndex]));
        }}
      />
    </div>
  );
}
