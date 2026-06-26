const profile = {
  name: "Anvith Vanukuri",
  initials: "AV",
  photo: "assets/profile-placeholder.svg",
  summary:
    "I am a student and builder interested in software, problem solving, and creating useful projects. This site highlights my coursework, experience, and GitHub work.",
  about:
    "I enjoy learning new technologies, taking challenging classes, and applying what I learn through hands-on projects. I am focused on growing as a developer while building work that is practical, thoughtful, and easy to use.",
  socials: [
    {
      label: "GitHub",
      icon: "GH",
      url: "https://github.com/AVcool3",
      featured: true,
    },
    {
      label: "LinkedIn",
      icon: "in",
      url: "https://www.linkedin.com/",
      featured: true,
    },
    {
      label: "Email",
      icon: "@",
      url: "mailto:your.email@example.com",
      featured: false,
    },
  ],
  courses: [
    {
      title: "Data Structures and Algorithms",
      description: "Core programming concepts, algorithm analysis, and efficient problem solving.",
      skills: ["Algorithms", "Complexity", "Problem Solving"],
    },
    {
      title: "Web Development",
      description: "Building responsive interfaces and interactive experiences with HTML, CSS, and JavaScript.",
      skills: ["HTML", "CSS", "JavaScript"],
    },
    {
      title: "Database Systems",
      description: "Relational data modeling, querying, and organizing application data.",
      skills: ["SQL", "Schema Design", "Data Modeling"],
    },
    {
      title: "Computer Systems",
      description: "Understanding how software interacts with operating systems and lower-level architecture.",
      skills: ["Systems", "Linux", "Architecture"],
    },
    {
      title: "Software Engineering",
      description: "Planning, implementing, testing, and maintaining software in a team-oriented workflow.",
      skills: ["Testing", "Git", "Teamwork"],
    },
    {
      title: "Discrete Mathematics",
      description: "Mathematical foundations for logic, proofs, graphs, and computing theory.",
      skills: ["Logic", "Proofs", "Graphs"],
    },
  ],
  experiences: [
    {
      role: "Student Developer",
      organization: "Academic and personal projects",
      period: "Current",
      description:
        "Building projects that turn classroom concepts into practical software, with an emphasis on clean interfaces and readable code.",
    },
    {
      role: "Coursework and Collaboration",
      organization: "University classes",
      period: "Recent",
      description:
        "Completed technical assignments, collaborated with classmates, and practiced breaking larger problems into reliable implementations.",
    },
    {
      role: "Independent Learning",
      organization: "Self-directed practice",
      period: "Ongoing",
      description:
        "Exploring tools, frameworks, and development habits that support stronger problem solving and better user experiences.",
    },
  ],
  projects: [
    {
      title: "Personal Website",
      description:
        "A responsive personal portfolio built with HTML, CSS, and JavaScript to showcase coursework, experience, and projects.",
      repo: "https://github.com/AVcool3/AnvithVanukuri",
      skills: ["HTML", "CSS", "JavaScript"],
    },
    {
      title: "Project Repository",
      description:
        "Replace this card with one of your GitHub repositories and summarize the problem it solves.",
      repo: "https://github.com/AVcool3",
      skills: ["GitHub", "Portfolio"],
    },
    {
      title: "Featured Build",
      description:
        "Add another project here with the technologies used, your role, and what you learned from building it.",
      repo: "https://github.com/AVcool3",
      skills: ["Project", "Learning"],
    },
  ],
};

const byId = (id) => document.getElementById(id);

function createLink({ label, url }, className, text = label) {
  const link = document.createElement("a");
  link.className = className;
  link.href = url;
  link.textContent = text;

  if (!url.startsWith("mailto:")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  return link;
}

function createTags(skills) {
  const tags = document.createElement("ul");
  tags.className = "tag-list";

  skills.forEach((skill) => {
    const tag = document.createElement("li");
    tag.className = "tag";
    tag.textContent = skill;
    tags.appendChild(tag);
  });

  return tags;
}

function renderSocialLinks() {
  const socialContainer = byId("social-links");
  const contactContainer = byId("contact-links");
  const actionsContainer = byId("hero-actions");

  profile.socials.forEach((social) => {
    const socialLink = createLink(social, "social-link", social.icon);
    socialLink.setAttribute("aria-label", social.label);
    socialContainer.appendChild(socialLink);

    const contactLink = createLink(social, "button", social.label);
    contactContainer.appendChild(contactLink);

    if (social.featured) {
      const action = createLink(social, social.label === "GitHub" ? "button primary" : "button");
      actionsContainer.appendChild(action);
    }
  });
}

function renderCourses() {
  const courseList = byId("course-list");

  profile.courses.forEach((course) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${course.title}</h3>
      <p>${course.description}</p>
    `;
    card.appendChild(createTags(course.skills));
    courseList.appendChild(card);
  });
}

function renderExperience() {
  const experienceList = byId("experience-list");

  profile.experiences.forEach((experience) => {
    const item = document.createElement("article");
    item.className = "timeline-item";
    item.innerHTML = `
      <p class="timeline-meta">${experience.period} | ${experience.organization}</p>
      <h3>${experience.role}</h3>
      <p>${experience.description}</p>
    `;
    experienceList.appendChild(item);
  });
}

function renderProjects() {
  const projectList = byId("project-list");

  profile.projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "card project-card";
    card.innerHTML = `
      <h3>${project.title}</h3>
      <p>${project.description}</p>
    `;
    card.appendChild(createTags(project.skills));
    card.appendChild(createLink({ label: "View Repository", url: project.repo }, "button"));
    projectList.appendChild(card);
  });
}

function setupNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const navLinks = byId("nav-links");

  toggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      navLinks.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function renderProfile() {
  byId("profile-name").textContent = profile.name;
  byId("profile-summary").textContent = profile.summary;
  byId("about-text").textContent = profile.about;
  byId("current-year").textContent = new Date().getFullYear();

  const photo = byId("profile-photo");
  photo.src = profile.photo;
  photo.alt = `Profile photo of ${profile.name}`;
}

renderProfile();
renderSocialLinks();
renderCourses();
renderExperience();
renderProjects();
setupNavigation();
